package handlers

import (
	"fmt"
	"net/http"
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
	db           *gorm.DB
	cfg          *config.Config
	userRepo     *repository.UserRepository
	auditService *services.AuditService
	cs           *services.CasbinService
}

func NewAuthHandler(db *gorm.DB,
	cfg *config.Config,
	userRepo *repository.UserRepository,
	auditService *services.AuditService,
	cs *services.CasbinService,
) *AuthHandler {
	return &AuthHandler{
		db:           db,
		cfg:          cfg,
		userRepo:     userRepo,
		auditService: auditService,
		cs:           cs,
	}
}

// Login godoc
//
//	@Summary		Login
//	@Description	Authenticates a user and starts a session
//	@Tags			auth
//	@Accept			json
//	@Produce		json
//	@Param			body	body		models.LoginRequest	true	"Login credentials"
//	@Success		200		{object}	map[string]interface{}
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		401		{object}	models.ErrorResponse
//	@Failure		403		{object}	models.ErrorResponse
//	@Failure		500		{object}	models.ErrorResponse
//	@Router			/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request"})
		return
	}

	user, err := h.userRepo.GetUserByUsername(req.Username)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
		return
	}

	// Check if blocked
	if user.BlockedAt != nil {
		c.JSON(http.StatusForbidden, models.ErrorResponse{Error: "Account blocked"})
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid credentials"})
		return
	}

	// After successful authentication:
	if err := middleware.SetSessionUser(h.db, c, int(user.ID), user.Role.Key, req.RememberMe); err != nil {
		fmt.Println("Failed to set session:", err)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to save session"})
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
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to clear session"})
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
//	@Param			body	body		models.PasswordChangeRequest	true	"Password change info"
//	@Success		200		{object}	map[string]interface{}
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		401		{object}	models.ErrorResponse
//	@Failure		500		{object}	models.ErrorResponse
//	@Router			/me/password [put]
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req models.PasswordChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request"})
		return
	}

	// Get current password hash using GORM
	var user models.User
	if err := h.db.Select("password_hash").Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "User not found"})
		return
	}

	// Verify old password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, models.ErrorResponse{Error: "Invalid current password"})
		return
	}

	if err := h.userRepo.UpdatePassword(userID, req.NewPassword); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to update password"})
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
