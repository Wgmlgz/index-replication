package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID             int    `gorm:"primaryKey;autoIncrement"`
	Username       string `gorm:"uniqueIndex;not null;size:255"`
	PasswordHash   string `gorm:"not null;size:60"`
	FullName       string `gorm:"not null;size:255"`
	RoleID         int    `gorm:"not null"`
	Phone          string `gorm:"size:50"`
	Email          string `gorm:"size:255"`
	LastActive     *time.Time
	BlockedAt      *time.Time
	CreatedAt      time.Time     `gorm:"autoCreateTime"`
	Role           *Role         `gorm:"foreignKey:RoleID"`
	Comment        string        `gorm:"type:text"`
}

func (u *User) SetPassword(password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	return nil
}

// BeforeCreate is a GORM hook that will be called before creating a record
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.CreatedAt.IsZero() {
		u.CreatedAt = time.Now()
	}
	return nil
}

func NewUserResponse(user *User) UserResponse {
	resp := UserResponse{
		ID:             user.ID,
		Username:       user.Username,
		FullName:       user.FullName,
		RoleID:         user.RoleID,
		Phone:          user.Phone,
		Email:          user.Email,
		LastActive:     user.LastActive,
		BlockedAt:      user.BlockedAt,
		IsBlocked:      user.BlockedAt != nil,
		CreatedAt:      user.CreatedAt,
		Comment:        user.Comment,
	}

	if user.Role != nil {
		resp.RoleKey = user.Role.Key
	}

	return resp
}

type Permission struct {
	Obj string `json:"obj" binding:"required"`
	Act string `json:"act" binding:"required"`
}

type PermissionsResponse struct {
	User        UserResponse `json:"user" binding:"required"`
	Permissions []Permission `json:"permissions" binding:"required"`
}

// UserResponse represents a user in API responses
// swagger:model
type UserResponse struct {
	ID               int        `json:"id" binding:"required"`
	Username         string     `json:"username" binding:"required"`
	FullName         string     `json:"full_name" binding:"required"`
	RoleID           int        `json:"role_id" binding:"required"`
	RoleKey          string     `json:"role_key" binding:"required"`
	Phone            string     `json:"phone,omitempty" binding:"required"`
	Email            string     `json:"email,omitempty" binding:"required"`
	LastActive       *time.Time `json:"last_active,omitempty" binding:"required"`
	BlockedAt        *time.Time `json:"blocked_at,omitempty" binding:"required"`
	IsBlocked        bool       `json:"is_blocked" binding:"required"`
	CreatedAt        time.Time  `json:"created_at" binding:"required"`
	Comment          string     `json:"comment" binding:"required"`
}

// UserListResponse represents a paginated list of users
// swagger:model
type UserListResponse struct {
	Total    int            `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"page_size"`
	Users    []UserResponse `json:"users"`
}

// CreateUserRequest represents the request body for creating a user
// swagger:model
type CreateUserRequest struct {
	Username       string `json:"username" binding:"required"`
	Password       string `json:"password" binding:"required"`
	FullName       string `json:"full_name" binding:"required"`
	RoleID         int    `json:"role_id" binding:"required"`
	Comment        string `json:"comment"`
}

// UpdateUserRequest represents the request body for updating a user
// swagger:model
type UpdateUserRequest struct {
	FullName       string  `json:"full_name"`
	Phone          string  `json:"phone"`
	Email          string  `json:"email"`
	Password       *string `json:"password"`
	RoleID         int     `json:"role_id"`
	Comment        string  `json:"comment"`
}
