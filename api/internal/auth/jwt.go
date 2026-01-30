package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	tokenTypeAccess  = "access"
	tokenTypeRefresh = "refresh"
)

type Manager struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
	issuer     string
}

type Claims struct {
	jwt.RegisteredClaims
	UserID    int64  `json:"uid"`
	Email     string `json:"email,omitempty"`
	TokenType string `json:"typ"`
}

func NewManager(secret []byte, accessTTL, refreshTTL time.Duration, issuer string) *Manager {
	return &Manager{
		secret:     secret,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
		issuer:     issuer,
	}
}

func (m *Manager) NewAccessToken(userID int64, email string) (string, time.Time, error) {
	expiresAt := time.Now().Add(m.accessTTL)
	claims := Claims{
		UserID:    userID,
		Email:     email,
		TokenType: tokenTypeAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   fmt.Sprintf("%d", userID),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.secret)
	return signed, expiresAt, err
}

func (m *Manager) NewRefreshToken(userID int64) (string, time.Time, error) {
	expiresAt := time.Now().Add(m.refreshTTL)
	claims := Claims{
		UserID:    userID,
		TokenType: tokenTypeRefresh,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Subject:   fmt.Sprintf("%d", userID),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.secret)
	return signed, expiresAt, err
}

func (m *Manager) ParseAccessToken(token string) (Claims, error) {
	return m.parse(token, tokenTypeAccess)
}

func (m *Manager) ParseRefreshToken(token string) (Claims, error) {
	return m.parse(token, tokenTypeRefresh)
}

func (m *Manager) parse(token string, tokenType string) (Claims, error) {
	claims := Claims{}
	parsed, err := jwt.ParseWithClaims(token, &claims, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil || !parsed.Valid {
		return Claims{}, errors.New("invalid token")
	}
	if claims.TokenType != tokenType {
		return Claims{}, errors.New("invalid token type")
	}
	return claims, nil
}
