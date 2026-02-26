package handlers

import (
	"fmt"
	"net/http"
	"server/internal/api/dto"
	"server/internal/config"
	"server/internal/middleware"
	"server/internal/models"
	"server/internal/repository"
	"server/internal/services"
	"server/internal/utils"
	"strconv"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userRepo     *repository.UserRepository
	cfg          *config.Config
	cs           *services.CasbinService
	auditService *services.AuditService
}

func NewUserHandler(
	cfg *config.Config,
	userRepo *repository.UserRepository,
	cs *services.CasbinService,
	auditService *services.AuditService) *UserHandler {
	return &UserHandler{
		userRepo:     userRepo,
		cfg:          cfg,
		cs:           cs,
		auditService: auditService,
	}
}

// ListUsers godoc
//
//	@Summary		List users
//	@Description	Returns a paginated list of users
//	@Tags			users
//	@Produce		json
//	@Param			page		query		int		false	"Page number"
//	@Param			page_size	query		int		false	"Page size"
//	@Param			search		query		string	false	"Search term"
//	@Param			sort_by		query		string	false	"Sort by field"
//	@Param			sort_dir		query		string	false	"Sort direction (asc/desc)"
//	@Success		200			{object}	dto.UserListResponse
//	@Failure		500			{object}	dto.ErrorResponse
//	@Router			/users [get]
func (h *UserHandler) ListUsers(c *gin.Context) {
	// Pagination
	page := 1
	pageSize := 20
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
		if page < 1 {
			page = 1
		}
	}
	if ps := c.Query("page_size"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
		if pageSize < 1 || pageSize > 100 {
			pageSize = 20
		}
	}

	// Search
	search := c.Query("search")

	// Sorting
	sortBy := c.DefaultQuery("sort_by", "id")
	sortDir := c.DefaultQuery("sort_dir", "asc")
	if sortDir != "asc" && sortDir != "desc" {
		sortDir = "asc"
	}

	users, total, err := h.userRepo.ListUsers(page, pageSize, search, sortBy, sortDir, CheckViewRoot(h, c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
		return
	}

	var userList []dto.UserResponse
	for _, user := range users {
		userList = append(userList, dto.NewUserResponse(&user))
	}

	c.JSON(http.StatusOK, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"users":     userList,
	})
}

// CreateUser godoc
//
//	@Summary		Create user
//	@Description	Creates a new user
//	@Tags			users
//	@Accept			json
//	@Produce		json
//	@Param			body	body		dto.CreateUserRequest	true	"User info"
//	@Success		201		{object}	map[string]string
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		401		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/users [post]
func (h *UserHandler) CreateUser(c *gin.Context) {
	// Get current user ID from context
	performedBy := utils.GetRequestContext(c).UserID

	var req dto.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid request"})
		return
	}
	if !CheckModifyUser(h, c, req.RoleID) {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Role assignment denied"})
		return
	}

	if _, err := h.userRepo.GetUserByUsername(req.Username); err == nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Username already taken"})
		return
	}

	user, err := h.userRepo.CreateUser(repository.CreateUserInput{
		Username: req.Username,
		Password: req.Password,
		FullName: req.FullName,
		RoleID:   req.RoleID,
		Comment:  req.Comment,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to create user"})
		return
	}

	// Log the action
	h.auditService.LogUserAction(
		performedBy,
		models.ActionUserCreated,
		user.ID,
		map[string]interface{}{
			"username":  user.Username,
			"full_name": user.FullName,
			"role_id":   user.RoleID,
		},
	)

	c.JSON(http.StatusCreated, gin.H{"message": "User created successfully"})
}

// GetUser godoc
// @Summary      Get user
// @Description  Returns details of a user
// @Tags         users
// @Produce      json
// @Param        id   path      int  true  "User ID"
// @Success      200  {object}  dto.UserResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /users/{id} [get]
func (h *UserHandler) GetUser(c *gin.Context) {
	id, ok := CheckAccessToUserByIdAllowSelf(h, c)
	if !ok {
		return
	}
	user, err := h.userRepo.GetUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "User not found"})
		return
	}
	resp := dto.NewUserResponse(user)
	c.JSON(http.StatusOK, resp)
}

// UpdateUser godoc
//
//	@Summary		Update user
//	@Description	Updates an existing user
//	@Tags			users
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int							true	"User ID"
//	@Param			body	body		dto.UpdateUserRequest	true	"User update info"
//	@Success		200		{object}	map[string]string
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		401		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/users/{id} [put]
func (h *UserHandler) UpdateUser(c *gin.Context) {
	id, ok := CheckAccessToUserById(h, c)
	if !ok {
		return
	}

	var req dto.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid request"})
		return
	}

	{
		// Can edit users with role R, if have permission to create users with role R
		user, err := h.userRepo.GetUserByID(id)
		if err != nil {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "User not found"})
			return
		}
		if !CheckModifyUser(h, c, user.RoleID) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Updating this user is not allowed"})
			return
		}
	}

	if !CheckModifyUser(h, c, req.RoleID) {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Role change denied"})
		return
	}

	user, action, oldUser, newUser, err := h.userRepo.UpdateUser(id, repository.UpdateUserInput{
		FullName: req.FullName,
		Phone:    req.Phone,
		Email:    req.Email,
		Password: req.Password,
		RoleID:   req.RoleID,
		Comment:  req.Comment,
	})
	if err != nil {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "User not updated"})
		return
	}

	performedBy := utils.GetRequestContext(c).UserID
	h.auditService.LogUserAction(
		performedBy,
		action,
		user.ID,
		map[string]interface{}{"old": dto.NewUserResponse(oldUser), "new": dto.NewUserResponse(newUser)},
	)

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully"})
}

// UpdateUser godoc
//
//	@Summary		Get self info
//	@Description	Returns profile on logged in user
//	@Tags			users
//	@Accept			json
//	@Produce		json
//	@Success		200		{object}  dto.PermissionsResponse
//	@Failure		401		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Router			/me [get]
func (h *UserHandler) GetCurrentUser(c *gin.Context) {
	reqCtx := utils.GetRequestContext(c)
	userID := reqCtx.UserID
	role := reqCtx.RoleKey

	user, err := h.userRepo.GetCurrentUser(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "User not found"})
		return
	}

	rawPermissions := h.cs.GetPermissionsForRole(role)

	permissions := make([]dto.Permission, 0)
	for _, p := range rawPermissions {
		if len(p) >= 2 {
			permissions = append(permissions, dto.Permission{Obj: p[1], Act: p[2]})
		}
	}

	c.JSON(http.StatusOK, dto.PermissionsResponse{Permissions: permissions, User: dto.NewUserResponse(user)})
}

// BlockUser godoc
// @Summary      Block user
// @Description  Blocks a user and terminates their sessions
// @Tags         users
// @Produce      json
// @Param        id   path      int  true  "User ID"
// @Success      200  {object}  map[string]string
// @Failure      404  {object}  dto.ErrorResponse
// @Failure      500  {object}  dto.ErrorResponse
// @Router       /users/{id}/block [post]
func (h *UserHandler) BlockUser(c *gin.Context) {
	id, ok := CheckAccessToUserById(h, c)
	if !ok {
		return
	}
	user, err := h.userRepo.BlockUser(id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "User not found"})
		return
	}
	// Audit log
	performedBy := utils.GetRequestContext(c).UserID
	h.auditService.LogUserAction(performedBy, models.ActionUserBlocked, user.ID, nil)
	c.JSON(http.StatusOK, gin.H{"message": "User blocked"})
}

// UnblockUser godoc
// @Summary      Unblock user
// @Description  Unblocks a user
// @Tags         users
// @Produce      json
// @Param        id   path      int  true  "User ID"
// @Success      200  {object}  map[string]string
// @Failure      404  {object}  dto.ErrorResponse
// @Failure      500  {object}  dto.ErrorResponse
// @Router       /users/{id}/unblock [post]
func (h *UserHandler) UnblockUser(c *gin.Context) {
	id, ok := CheckAccessToUserById(h, c)
	if !ok {
		return
	}
	user, err := h.userRepo.UnblockUser(id)
	if err != nil {
		c.JSON(http.StatusNotModified, dto.ErrorResponse{Error: "User not unblocked"})
		return
	}

	// Audit log
	performedBy := utils.GetRequestContext(c).UserID
	h.auditService.LogUserAction(performedBy, models.ActionUserUnblocked, user.ID, nil)
	c.JSON(http.StatusOK, gin.H{"message": "User unblocked"})
}

// DeleteUser godoc
// @Summary Delete a user
// @Description Delete a user by ID
// @Tags users
// @Accept json
// @Produce json
// @Param id path string true "User ID"
// @Success 204 "No Content"
// @Failure 400 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Failure 500 {object} dto.ErrorResponse
// @Router /users/{id} [delete]
func (h *UserHandler) DeleteUser(c *gin.Context) {
	id, ok := CheckAccessToUserById(h, c)
	if !ok {
		return
	}

	user, err := h.userRepo.GetUserByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "User not found"})
		return
	}
	if user.BlockedAt == nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Can't delete active (not blocked) user"})
		return
	}
	if !CheckDeleteUser(h, c, user.RoleID) {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Can't delete user with this role"})
		return
	}

	if h.userRepo.DeleteUser(c.Request.Context(), id) != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to delete user"})
		return
	}
	// Log the action
	performedBy := utils.GetRequestContext(c).UserID
	idInt, _ := strconv.Atoi(id)
	h.auditService.LogUserAction(
		performedBy,
		models.ActionUserDeleted,
		idInt,
		nil,
	)
	c.Status(http.StatusNoContent)
}

// Checks if can edit given user by id
func CheckAccessToUserById(h *UserHandler, c *gin.Context) (string, bool) {
	id := c.Param("id")

	if id == strconv.Itoa(utils.GetRequestContext(c).UserID) {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Cant modify self via this route"})
		return "", false
	}

	return CheckAccessToUserByIdAllowSelf(h, c)
}

// Checks if can edit given user by id
func CheckAccessToUserByIdAllowSelf(h *UserHandler, c *gin.Context) (string, bool) {
	id := c.Param("id")

	if _, err := h.userRepo.GetUserByID(id); err != nil {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "User not found"})
		return "", false
	}

	return id, true
}

func CheckModifyUser(h *UserHandler, c *gin.Context, roleID int) bool {
	// Check if current allowed to create users with role
	roleKey, err := h.userRepo.GetRoleKeyByID(roleID)
	if err != nil {
		return false
	}
	return middleware.RP(h.cs, c, config.Permission{
		Obj: "users",
		Act: "create_role_" + roleKey,
	})
}

func CheckViewRoot(h *UserHandler, c *gin.Context) bool {
	return middleware.RP(h.cs, c, config.Permission{
		Obj: "users",
		Act: "view_root",
	})
}

func CheckDeleteUser(h *UserHandler, c *gin.Context, roleID int) bool {
	// Check if current allowed to create users with role
	roleKey, err := h.userRepo.GetRoleKeyByID(roleID)
	if err != nil {
		return false
	}
	return middleware.RP(h.cs, c, config.Permission{
		Obj: "users",
		Act: "delete_role_" + roleKey,
	})
}
