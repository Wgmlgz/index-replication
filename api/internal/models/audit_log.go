package models

import "time"

type AuditLog struct {
	ID          int    `gorm:"primaryKey;autoIncrement"`
	PerformedBy int    `gorm:"not null"`
	Action      string `gorm:"not null;size:50"`
	Severity    string `gorm:"not null;size:16;default:info"`
	EntityType  string `gorm:"not null;size:50"`
	EntityID    *int
	Details     string    `gorm:"type:text"`
	Timestamp   time.Time `gorm:"autoCreateTime"`

	// Relations
	PerformedByUser *User `gorm:"foreignKey:PerformedBy"`
}

// Audit severity constants.
const (
	SeverityDebug    = "debug"
	SeverityInfo     = "info"
	SeverityWarning  = "warning"
	SeverityError    = "error"
	SeverityCritical = "critical"
)

// AuditLogAction constants
const (
	ActionUserCreated                = "user_created"
	ActionUserUpdated                = "user_updated"
	ActionUserDeleted                = "user_deleted"
	ActionUserBlocked                = "user_blocked"
	ActionUserUnblocked              = "user_unblocked"
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
	ActionTBankSandboxPayOut         = "tbank_sandbox_pay_out"
	ActionTBankBuyOrderCreated       = "tbank_buy_order_created"
	ActionTBankSellOrderCreated      = "tbank_sell_order_created"
	ActionPortfolioProfileCreated    = "portfolio_profile_created"
	ActionPortfolioProfileUpdated    = "portfolio_profile_updated"
	ActionPortfolioProfileDeleted    = "portfolio_profile_deleted"
	ActionPortfolioActionExecuted    = "portfolio_action_executed"
	ActionPortfolioRebalanceCreated  = "portfolio_rebalance_created"
	ActionPortfolioRebalanceFailed   = "portfolio_rebalance_planning_failed"
	ActionPortfolioRebalanceDeleted  = "portfolio_rebalance_deleted"
	ActionPortfolioRebalanceQueued   = "portfolio_rebalance_queued"
	ActionPortfolioRebalanceFinished = "portfolio_rebalance_finished"
	ActionRebalanceConfirmationSent  = "rebalance_confirmation_sent"
	ActionRebalanceConfirmationYes   = "rebalance_confirmation_approved"
	ActionRebalanceConfirmationNo    = "rebalance_confirmation_denied"
)

// AuditLogEntityType constants
const (
	EntityTypeUser   = "user"
	EntityTypeSystem = "system"
)
