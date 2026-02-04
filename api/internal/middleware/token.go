package middleware

import (
	"server/internal/config"

	"github.com/gin-gonic/gin"
)

func TokenAuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		validateToken(cfg, c)
	}
}

func checkToken(correct, token string) bool {
	return correct == token
}

func validateToken(cfg *config.Config, c *gin.Context) {
	token := c.Request.Header.Get("X-Auth-Token")
	if token == "" {
		c.AbortWithStatus(401)
	} else if checkToken(cfg.BotsToken, token) {
		c.Next()
	} else {
		c.AbortWithStatus(401)
	}
}
