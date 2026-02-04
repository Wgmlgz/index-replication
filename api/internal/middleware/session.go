package middleware

import (
	"net/http"
	"server/internal/models"
	"server/internal/utils"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	sessionUserID  = "userID"
	sessionRoleKey = "roleKey"
)

func SessionAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		userID, ok := session.Get(sessionUserID).(int)
		if !ok || userID == 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
			return
		}

		roleKey, _ := session.Get(sessionRoleKey).(string)

		// Create and store the custom context
		reqCtx := &utils.RequestContext{
			UserID:  userID,
			RoleKey: roleKey,
		}
		c.Set(utils.CustomContextKey, reqCtx)

		c.Next()
	}
}

func SetSessionUser(db *gorm.DB, c *gin.Context, userID int, roleKey string, rememberMe bool) error {
	session := sessions.Default(c)

	// Delete old session from DB to clean up
	models.DeleteUserSession(db, session.ID())

	// Force a new session ID by expiring the old cookie
	session.Clear()
	session.Options(sessions.Options{MaxAge: -1})
	if err := session.Save(); err != nil {
		return err
	}

	// Now, set up the new session
	session.Set(sessionUserID, userID)
	session.Set(sessionRoleKey, roleKey)

	// Set session expiration
	expiration := 24 * time.Hour // Default session duration
	if rememberMe {
		expiration = 30 * 24 * time.Hour // 30 days for "Remember me"
	}

	session.Options(sessions.Options{
		MaxAge:   int(expiration.Seconds()),
		HttpOnly: true,
		Secure:   false, // Set to true in production for HTTPS
		// Secure:   true, // Use true in production
	})
	if err := session.Save(); err != nil {
		return err
	}

	err := models.CreateUserSession(db, userID, session.ID())
	if err != nil {
		return err
	}
	return nil
}

func ClearSession(db *gorm.DB, c *gin.Context) error {
	session := sessions.Default(c)
	session.Clear()
	session.Options(sessions.Options{MaxAge: -1})
	if err := session.Save(); err != nil {
		return err
	}
	models.DeleteUserSession(db, session.ID())

	return nil
}
