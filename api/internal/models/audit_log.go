package models

import (
	"time"
)

type AuditLog struct {
	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	PerformedBy int       `gorm:"not null" json:"performed_by"`
	Action      string    `gorm:"not null;size:50" json:"action"`
	EntityType  string    `gorm:"not null;size:50" json:"entity_type"`
	EntityID    *int      `json:"entity_id"`
	Details     string    `gorm:"type:text" json:"details"`
	Timestamp   time.Time `gorm:"autoCreateTime" json:"timestamp"`

	// Relations
	PerformedByUser *User `gorm:"foreignKey:PerformedBy" json:"performed_by_user,omitempty"`
}

// AuditLogAction constants
const (
	ActionUserCreated                = "user_created"
	ActionUserUpdated                = "user_updated"
	ActionUserDeleted                = "user_deleted"
	ActionUserBlocked                = "user_blocked"
	ActionUserUnblocked              = "user_unblocked"
	ActionPasswordReset              = "password_reset"
	ActionPasswordChanged            = "password_changed"
	ActionUserLogin                  = "user_login"
	ActionUserLogout                 = "user_logout"
	ActionLoginVerificationRequested = "login_verification_requested"
	ActionLoginVerificationApproved  = "login_verification_approved"
	ActionLoginVerificationDenied    = "login_verification_denied"
	ActionTelegramConnected          = "telegram_connected"
	ActionTelegramDisconnected       = "telegram_disconnected"
	ActionTelegram2FAUpdated         = "telegram_2fa_updated"
	ActionTBankConnected             = "tbank_connected"
	ActionTBankDisconnected          = "tbank_disconnected"
	ActionTBankDefaultAccountUpdated = "tbank_default_account_updated"
	ActionTBankSandboxPayIn          = "tbank_sandbox_pay_in"
	ActionTBankTestBuyCreated        = "tbank_test_buy_created"
)

// AuditLogEntityType constants
const (
	EntityTypeUser   = "user"
	EntityTypeSystem = "system"
)

// AuditLogResponse represents an audit log entry in API responses
// swagger:model
type AuditLogResponse struct {
	ID          int        `json:"id" binding:"required"`
	Action      string     `json:"action" binding:"required"`
	EntityType  string     `json:"entity_type" binding:"required"`
	EntityID    *int       `json:"entity_id"`
	Details     string     `json:"details"`
	LogImage    *string    `json:"log_image"`
	Timestamp   time.Time  `json:"timestamp" binding:"required"`
	PerformedBy *UserShort `json:"performed_by,omitempty"`
}

type AuditLogListResponse struct {
	Total    int64              `json:"total" binding:"required"`
	Page     int                `json:"page" binding:"required"`
	PageSize int                `json:"page_size" binding:"required"`
	Logs     []AuditLogResponse `json:"logs" binding:"required"`
}

type UserShort struct {
	ID       int    `json:"id" binding:"required"`
	Username string `json:"username" binding:"required"`
	FullName string `json:"full_name" binding:"required"`
}
