package middleware

import (
	"net/http"
	"server/internal/config"
	"server/internal/models"
	"server/internal/utils"
	"strings"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	sessionUserID  = "userID"
	sessionRoleKey = "roleKey"
)

type SessionCookieOptions struct {
	Secure   bool
	Domain   string
	Path     string
	SameSite http.SameSite
}

func SessionCookieOptionsFromConfig(cfg *config.Config) SessionCookieOptions {
	path := strings.TrimSpace(cfg.SessionCookiePath)
	if path == "" {
		path = "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	return SessionCookieOptions{
		Secure:   cfg.SessionCookieSecure,
		Domain:   strings.TrimSpace(cfg.SessionCookieDomain),
		Path:     path,
		SameSite: parseSameSite(cfg.SessionCookieSameSite),
	}
}

func SessionAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		userID, ok := parseSessionUserID(session.Get(sessionUserID))
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
		c.Set(AuthModeContextKey, AuthModeSession)

		c.Next()
	}
}

func SetSessionUser(db *gorm.DB, c *gin.Context, userID int, roleKey string, rememberMe bool, cookieOptions SessionCookieOptions) error {
	session := sessions.Default(c)
	currentSessionID := session.ID()

	// Delete old session from DB to clean up
	models.DeleteUserSession(db, currentSessionID)

	// Force a new session ID by expiring the old cookie
	session.Clear()
	session.Options(newSessionOptions(-1, cookieOptions))
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

	session.Options(newSessionOptions(int(expiration.Seconds()), cookieOptions))
	if err := session.Save(); err != nil {
		return err
	}

	err := models.CreateUserSession(db, userID, session.ID())
	if err != nil {
		return err
	}
	return nil
}

func ClearSession(db *gorm.DB, c *gin.Context, cookieOptions SessionCookieOptions) error {
	session := sessions.Default(c)
	sessionID := session.ID()
	session.Clear()
	session.Options(newSessionOptions(-1, cookieOptions))
	if err := session.Save(); err != nil {
		return err
	}
	models.DeleteUserSession(db, sessionID)

	return nil
}

func parseSessionUserID(value interface{}) (int, bool) {
	switch v := value.(type) {
	case int:
		return v, true
	case int64:
		return int(v), true
	case int32:
		return int(v), true
	case int16:
		return int(v), true
	case int8:
		return int(v), true
	case uint:
		return int(v), true
	case uint64:
		return int(v), true
	case uint32:
		return int(v), true
	case uint16:
		return int(v), true
	case uint8:
		return int(v), true
	default:
		return 0, false
	}
}

func newSessionOptions(maxAge int, cookieOptions SessionCookieOptions) sessions.Options {
	return sessions.Options{
		Path:     cookieOptions.Path,
		Domain:   cookieOptions.Domain,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   cookieOptions.Secure,
		SameSite: cookieOptions.SameSite,
	}
}

func parseSameSite(value string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	case "default":
		return http.SameSiteDefaultMode
	default:
		return http.SameSiteLaxMode
	}
}
