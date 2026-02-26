package middleware

import (
	"net/http"
	"server/internal/api/dto"
	"server/internal/config"
	"server/internal/services"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

// Require Permission Middleware is a middleware that checks if the user has permission to access the resource
func RPM(casbinService *services.CasbinService, permission config.Permission) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if !RP(casbinService, ctx, permission) {
			ctx.AbortWithStatusJSON(http.StatusForbidden, dto.ErrorResponse{Error: "Forbidden"})
			return
		}
		ctx.Next()
	}
}

// Require Permission checks if the user has permission to access the resource
func RP(
	c *services.CasbinService,
	ctx *gin.Context,
	permission config.Permission,
) bool {
	role := utils.GetRequestContext(ctx).RoleKey
	return c.CheckPermission(role, permission)
}
