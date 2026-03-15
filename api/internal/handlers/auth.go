package handlers

import (
	"net/http"
	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/repository"
	"server/internal/services"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db           *gorm.DB
	userRepo     *repository.UserRepository
	auditService *services.AuditService
}

func NewAuthHandler(db *gorm.DB,
	userRepo *repository.UserRepository,
	auditService *services.AuditService,
) *AuthHandler {
	return &AuthHandler{
		db:           db,
		userRepo:     userRepo,
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
