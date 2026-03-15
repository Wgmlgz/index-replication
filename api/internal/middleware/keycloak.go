package middleware

import (
	"errors"
	"log"
	"net/http"
	keycloakauth "server/internal/auth"
	"server/internal/repository"
	"server/internal/utils"
	"strings"

	"github.com/gin-gonic/gin"
)

func KeycloakJWTAuthMiddleware(
	keycloakAuth *keycloakauth.KeycloakAuthenticator,
	userRepo *repository.UserRepository,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		if keycloakAuth == nil || !keycloakAuth.Enabled() {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "Keycloak auth is not configured"})
			return
		}

		token, err := bearerTokenFromAuthorizationHeader(c.GetHeader("Authorization"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
			return
		}

		claims, err := keycloakAuth.VerifyToken(c.Request.Context(), token)
		if err != nil {
			switch {
			case errors.Is(err, keycloakauth.ErrInvalidKeycloakToken), errors.Is(err, keycloakauth.ErrMissingKeycloakSub):
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid Keycloak token"})
			default:
				log.Printf("keycloak auth verify failed: %v", err)
				c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "Failed to verify Keycloak token"})
			}
			return
		}

		user, _, err := userRepo.EnsureUserByKeycloakSub(repository.EnsureKeycloakUserInput{
			Sub:               claims.Sub,
			PreferredUsername: claims.PreferredUsername,
			Email:             claims.Email,
			FullName:          claims.Name,
		})
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to load or create user"})
			return
		}

		if user.BlockedAt != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Account blocked"})
			return
		}

		roleKey := ""
		if user.Role != nil {
			roleKey = user.Role.Key
		}
		if roleKey == "" {
			roleKey, err = userRepo.GetRoleKeyByID(user.RoleID)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve user role"})
				return
			}
		}

		_ = userRepo.UpdateLastActive(user)

		c.Set(utils.CustomContextKey, &utils.RequestContext{
			UserID:  user.ID,
			RoleKey: roleKey,
		})
		c.Next()
	}
}

func bearerTokenFromAuthorizationHeader(header string) (string, error) {
	header = strings.TrimSpace(header)
	if header == "" {
		return "", errors.New("authorization header is empty")
	}

	const prefix = "Bearer "
	if len(header) < len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", errors.New("authorization header is not bearer")
	}

	token := strings.TrimSpace(header[len(prefix):])
	if token == "" {
		return "", errors.New("bearer token is empty")
	}
	return token, nil
}
