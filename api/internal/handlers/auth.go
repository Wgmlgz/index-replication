package handlers

import (
	"net/http"
	"server/internal/models"
	"server/internal/services"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	auditService *services.AuditService
}

func NewAuthHandler(auditService *services.AuditService) *AuthHandler {
	return &AuthHandler{
		auditService: auditService,
	}
}

// Logout godoc
//
//	@Summary		Logout
//	@Description	Logs out the current user
//	@Tags			auth
//	@Produce		json
//	@Success		200	{object}	map[string]string
//	@Router			/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	performedBy := utils.GetRequestContext(c).UserID

	h.auditService.LogUserDebugAction(
		performedBy,
		models.ActionUserLogout,
		performedBy,
		nil,
	)

	c.JSON(http.StatusOK, gin.H{"message": "Successfully logged out"})
}
