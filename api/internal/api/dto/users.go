package dto

import (
	"time"

	"server/internal/models"
)

type Permission struct {
	Obj string `json:"obj" binding:"required"`
	Act string `json:"act" binding:"required"`
} //@name Permission

type PermissionsResponse struct {
	User        UserResponse `json:"user" binding:"required"`
	Permissions []Permission `json:"permissions" binding:"required"`
} //@name PermissionsResponse

type UserResponse struct {
	ID         int        `json:"id" binding:"required"`
	Username   string     `json:"username" binding:"required"`
	FullName   string     `json:"full_name" binding:"required"`
	RoleID     int        `json:"role_id" binding:"required"`
	RoleKey    string     `json:"role_key" binding:"required"`
	LastActive *time.Time `json:"last_active,omitempty" binding:"required"`
	BlockedAt  *time.Time `json:"blocked_at,omitempty" binding:"required"`
	IsBlocked  bool       `json:"is_blocked" binding:"required"`
	CreatedAt  time.Time  `json:"created_at" binding:"required"`
	Comment    string     `json:"comment" binding:"required"`
} //@name UserResponse

type UserListResponse struct {
	Total    int            `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"page_size"`
	Users    []UserResponse `json:"users"`
} //@name UserListResponse

type CreateUserRequest struct {
	Username string `json:"username" binding:"required"`
	FullName string `json:"full_name" binding:"required"`
	RoleID   int    `json:"role_id" binding:"required"`
	Comment  string `json:"comment"`
} //@name CreateUserRequest

type UpdateUserRequest struct {
	FullName string `json:"full_name"`
	RoleID   int    `json:"role_id"`
	Comment  string `json:"comment"`
} //@name UpdateUserRequest

func NewUserResponse(user *models.User) UserResponse {
	resp := UserResponse{
		ID:         user.ID,
		Username:   user.Username,
		FullName:   user.FullName,
		RoleID:     user.RoleID,
		LastActive: user.LastActive,
		BlockedAt:  user.BlockedAt,
		IsBlocked:  user.BlockedAt != nil,
		CreatedAt:  user.CreatedAt,
		Comment:    user.Comment,
	}

	if user.Role != nil {
		resp.RoleKey = user.Role.Key
	}

	return resp
}
