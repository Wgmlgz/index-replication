package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"server/internal/api/dto"
	"server/internal/config"
	"server/internal/middleware"
	"server/internal/models"
	"server/internal/repository"
	"server/internal/services"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db                  *gorm.DB
	cfg                 *config.Config
	userRepo            *repository.UserRepository
	auditService        *services.AuditService
	cs                  *services.CasbinService
	verificationService *services.VerificationService
}

func NewAuthHandler(db *gorm.DB,
	cfg *config.Config,
	userRepo *repository.UserRepository,
	auditService *services.AuditService,
	cs *services.CasbinService,
	verificationService *services.VerificationService,
) *AuthHandler {
	return &AuthHandler{
		db:                  db,
		cfg:                 cfg,
		userRepo:            userRepo,
		auditService:        auditService,
		cs:                  cs,
		verificationService: verificationService,
	}
}

// Login godoc
//
//	@Summary		Login
//	@Description	Authenticates a user and starts a session
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		dto.LoginRequest	true	"Login credentials"
//	@Success		200		{object}	map[string]interface{}
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		401		{object}	dto.ErrorResponse
//	@Failure		403		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid request"})
		return
	}

	user, err := h.userRepo.GetUserByUsername(req.Username)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "Invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
		return
	}

	// Check if blocked
	if user.BlockedAt != nil {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Error: "Account blocked"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "Invalid credentials"})
		return
	}

	challenge, err := h.verificationService.CreateLoginChallengeIfEnabled(user, req.RememberMe)
	if err != nil {
		log.Printf("auth login: verification initialization failed user_id=%d username=%s err=%v", user.ID, user.Username, err)
		if errors.Is(err, services.ErrTelegramNotConnected) {
			c.JSON(http.StatusForbidden, dto.ErrorResponse{Error: "Telegram login verification is enabled, but Telegram account is not connected"})
			return
		}
		if errors.Is(err, services.ErrTelegramUnavailable) {
			c.JSON(http.StatusServiceUnavailable, dto.ErrorResponse{Error: "Login verification is temporarily unavailable"})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to initialize login verification"})
		return
	}
	if challenge != nil {
		c.JSON(http.StatusAccepted, dto.LoginVerificationPendingResponse{
			VerificationRequired: true,
			ChallengeID:          challenge.ID,
			ExpiresAt:            challenge.ExpiresAt,
		})
		return
	}

	// After successful authentication:
	if err := middleware.SetSessionUser(h.db, c, int(user.ID), user.Role.Key, req.RememberMe); err != nil {
		fmt.Println("Failed to set session:", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to save session"})
		return
	}

	h.userRepo.UpdateLastActive(user)

	// Log the login action
	h.auditService.LogUserAction(
		user.ID,
		models.ActionUserLogin,
		user.ID,
		map[string]interface{}{
			"username":    user.Username,
			"remember_me": req.RememberMe,
		},
	)

	// Return user info instead of token
	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully logged in",
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"role_id":  user.RoleID,
		},
	})
}

// VerifyLogin godoc
//
//	@Summary		Complete login verification
//	@Description	Checks Telegram challenge status and completes login when approved
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		dto.LoginVerifyRequest	true	"Verification challenge"
//	@Success		200		{object}	map[string]interface{}
//	@Success		202		{object}	dto.LoginVerifyStatusResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		401		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/login/verify [post]
func (h *AuthHandler) VerifyLogin(c *gin.Context) {
	var req dto.LoginVerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ChallengeID == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid request"})
		return
	}

	user, rememberMe, err := h.verificationService.ConsumeApprovedLoginChallenge(req.ChallengeID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrVerificationPending):
			c.JSON(http.StatusAccepted, dto.LoginVerifyStatusResponse{Status: models.VerificationStatusPending})
		case errors.Is(err, services.ErrVerificationDenied):
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "Login verification was denied"})
		case errors.Is(err, services.ErrVerificationExpired):
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "Login verification has expired"})
		case errors.Is(err, services.ErrVerificationConsumed):
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "Login verification has already been used"})
		case errors.Is(err, services.ErrVerificationNotFound):
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "Login verification request not found"})
		default:
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to verify login"})
		}
		return
	}

	if user.BlockedAt != nil {
		c.JSON(http.StatusForbidden, dto.ErrorResponse{Error: "Account blocked"})
		return
	}

	if err := middleware.SetSessionUser(h.db, c, int(user.ID), user.Role.Key, rememberMe); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to save session"})
		return
	}

	h.userRepo.UpdateLastActive(user)
	h.auditService.LogUserAction(
		user.ID,
		models.ActionUserLogin,
		user.ID,
		map[string]interface{}{
			"telegram_verification": true,
		},
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully logged in",
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"role_id":  user.RoleID,
		},
	})
}

// Logout godoc
//
//	@Summary		Logout
//	@Description	Logs out the current user and clears the session
//	@Tags			auth
//	@Produce		json
//	@Success		200	{object}	map[string]string
//	@Router			/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	// Get current user ID from context before clearing the session
	performedBy := utils.GetRequestContext(c).UserID

	if err := middleware.ClearSession(h.db, c); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to clear session"})
		return
	}

	// Log the logout action
	h.auditService.LogUserAction(
		performedBy,
		models.ActionUserLogout,
		performedBy,
		nil,
	)

	c.JSON(http.StatusOK, gin.H{"message": "Successfully logged out"})
}

// ChangePassword godoc
//
//	@Summary		Change Password
//	@Description	Changes the password for the current user
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		dto.PasswordChangeRequest	true	"Password change info"
//	@Success		200		{object}	map[string]interface{}
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		401		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/password [put]
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req dto.PasswordChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid request"})
		return
	}

	// Get current password hash using GORM
	var user models.User
	if err := h.db.Select("password_hash").Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "User not found"})
		return
	}

	// Verify old password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "Invalid current password"})
		return
	}

	if err := h.userRepo.UpdatePassword(userID, req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to update password"})
		return
	}

	// Log the password change action
	h.auditService.LogUserAction(
		userID,
		models.ActionPasswordChanged,
		userID,
		nil,
	)

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}
