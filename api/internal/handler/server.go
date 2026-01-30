package handler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"index-replication/api/internal/api"
	"index-replication/api/internal/auth"
	"index-replication/api/internal/db"
)

type Config struct {
	CookieDomain string
	CookieSecure bool
}

type Server struct {
	store *db.Store
	jwt   *auth.Manager
	cfg   Config
}

func NewServer(store *db.Store, jwt *auth.Manager, cfg Config) *Server {
	return &Server{store: store, jwt: jwt, cfg: cfg}
}

func (s *Server) Register(c *gin.Context) {
	var req api.AuthRequest
	if err := DecodeJSON(c, &req); err != nil {
		WriteError(c, http.StatusBadRequest, "invalid request")
		return
	}

	email, password := normalizeAuth(req)
	if !validAuth(email, password) {
		WriteError(c, http.StatusBadRequest, "invalid email or password")
		return
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		WriteError(c, http.StatusInternalServerError, "failed to create user")
		return
	}

	user, err := s.store.CreateUser(c.Request.Context(), email, hash)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			WriteError(c, http.StatusBadRequest, "email already in use")
			return
		}
		WriteError(c, http.StatusInternalServerError, "failed to create user")
		return
	}

	if err := s.issueTokens(c.Request.Context(), user, c); err != nil {
		WriteError(c, http.StatusInternalServerError, "failed to create session")
		return
	}

	WriteJSON(c, http.StatusCreated, api.AuthResponse{User: toAPIUser(user)})
}

func (s *Server) Login(c *gin.Context) {
	var req api.AuthRequest
	if err := DecodeJSON(c, &req); err != nil {
		WriteError(c, http.StatusBadRequest, "invalid request")
		return
	}

	email, password := normalizeAuth(req)
	if !validAuth(email, password) {
		WriteError(c, http.StatusUnauthorized, "invalid credentials")
		return
	}

	user, err := s.store.GetUserByEmail(c.Request.Context(), email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			WriteError(c, http.StatusUnauthorized, "invalid credentials")
			return
		}
		WriteError(c, http.StatusInternalServerError, "failed to login")
		return
	}

	if err := auth.CheckPassword(user.PasswordHash, password); err != nil {
		WriteError(c, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := s.issueTokens(c.Request.Context(), user, c); err != nil {
		WriteError(c, http.StatusInternalServerError, "failed to create session")
		return
	}

	WriteJSON(c, http.StatusOK, api.AuthResponse{User: toAPIUser(user)})
}

func (s *Server) Refresh(c *gin.Context) {
	refreshToken, err := readCookie(c, "refresh_token")
	if err != nil {
		WriteError(c, http.StatusUnauthorized, "missing refresh token")
		return
	}

	claims, err := s.jwt.ParseRefreshToken(refreshToken)
	if err != nil {
		WriteError(c, http.StatusUnauthorized, "invalid refresh token")
		return
	}

	tokenHash := hashToken(refreshToken)
	stored, err := s.store.GetRefreshToken(c.Request.Context(), tokenHash)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			WriteError(c, http.StatusUnauthorized, "invalid refresh token")
			return
		}
		WriteError(c, http.StatusInternalServerError, "failed to refresh session")
		return
	}

	if stored.ExpiresAt.Before(time.Now()) || stored.UserID != claims.UserID {
		WriteError(c, http.StatusUnauthorized, "refresh token expired")
		return
	}

	user, err := s.store.GetUserByID(c.Request.Context(), stored.UserID)
	if err != nil {
		WriteError(c, http.StatusUnauthorized, "invalid session")
		return
	}

	accessToken, accessExp, err := s.jwt.NewAccessToken(user.ID, user.Email)
	if err != nil {
		WriteError(c, http.StatusInternalServerError, "failed to refresh session")
		return
	}

	s.setAccessCookie(c, accessToken, accessExp)
	WriteJSON(c, http.StatusOK, api.AuthResponse{User: toAPIUser(user)})
}

func (s *Server) Logout(c *gin.Context) {
	refreshToken, _ := readCookie(c, "refresh_token")
	if refreshToken != "" {
		tokenHash := hashToken(refreshToken)
		_ = s.store.DeleteRefreshToken(c.Request.Context(), tokenHash)
	}

	s.clearCookie(c, "access_token", "/")
	s.clearCookie(c, "refresh_token", "/api/v1/auth")
	c.Status(http.StatusNoContent)
}

func (s *Server) Me(c *gin.Context) {
	accessToken, err := readCookie(c, "access_token")
	if err != nil {
		WriteError(c, http.StatusUnauthorized, "missing access token")
		return
	}

	claims, err := s.jwt.ParseAccessToken(accessToken)
	if err != nil {
		WriteError(c, http.StatusUnauthorized, "invalid access token")
		return
	}

	user, err := s.store.GetUserByID(c.Request.Context(), claims.UserID)
	if err != nil {
		WriteError(c, http.StatusUnauthorized, "invalid session")
		return
	}

	WriteJSON(c, http.StatusOK, api.AuthResponse{User: toAPIUser(user)})
}

func (s *Server) issueTokens(ctx context.Context, user db.User, c *gin.Context) error {
	accessToken, accessExp, err := s.jwt.NewAccessToken(user.ID, user.Email)
	if err != nil {
		return err
	}

	refreshToken, refreshExp, err := s.jwt.NewRefreshToken(user.ID)
	if err != nil {
		return err
	}

	tokenHash := hashToken(refreshToken)
	if err := s.store.SaveRefreshToken(ctx, user.ID, tokenHash, refreshExp); err != nil {
		return err
	}

	s.setAccessCookie(c, accessToken, accessExp)
	s.setRefreshCookie(c, refreshToken, refreshExp)
	return nil
}

func (s *Server) setAccessCookie(c *gin.Context, token string, expiresAt time.Time) {
	s.setCookie(c, "access_token", token, "/", expiresAt)
}

func (s *Server) setRefreshCookie(c *gin.Context, token string, expiresAt time.Time) {
	s.setCookie(c, "refresh_token", token, "/api/v1/auth", expiresAt)
}

func (s *Server) setCookie(c *gin.Context, name, value, path string, expiresAt time.Time) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		Domain:   s.cfg.CookieDomain,
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) clearCookie(c *gin.Context, name, path string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     path,
		Domain:   s.cfg.CookieDomain,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	})
}

func normalizeAuth(req api.AuthRequest) (string, string) {
	email := strings.ToLower(strings.TrimSpace(string(req.Email)))
	password := strings.TrimSpace(req.Password)
	return email, password
}

func validAuth(email, password string) bool {
	if email == "" || password == "" {
		return false
	}
	return len(password) >= 8
}

func toAPIUser(user db.User) api.User {
	return api.User{
		Id:        user.ID,
		Email:     openapi_types.Email(user.Email),
		CreatedAt: user.CreatedAt,
	}
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
