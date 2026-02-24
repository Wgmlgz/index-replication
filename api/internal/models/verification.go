package models

import "time"

const (
	VerificationPurposeLogin = "login"

	VerificationStatusPending  = "pending"
	VerificationStatusApproved = "approved"
	VerificationStatusDenied   = "denied"
	VerificationStatusConsumed = "consumed"
	VerificationStatusExpired  = "expired"
)

type VerificationChallenge struct {
	ID         string    `gorm:"primaryKey;size:64"`
	UserID     int       `gorm:"index;not null"`
	Purpose    string    `gorm:"size:64;not null"`
	Status     string    `gorm:"size:32;not null"`
	RememberMe bool      `gorm:"not null"`
	Details    string    `gorm:"type:text"`
	ExpiresAt  time.Time `gorm:"not null"`
	ApprovedAt *time.Time
	DeniedAt   *time.Time
	ConsumedAt *time.Time
	CreatedAt  time.Time `gorm:"autoCreateTime"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime"`
}

type TelegramConnectToken struct {
	Token      string    `gorm:"primaryKey;size:128"`
	UserID     int       `gorm:"index;not null"`
	ExpiresAt  time.Time `gorm:"not null"`
	ConsumedAt *time.Time
	CreatedAt  time.Time `gorm:"autoCreateTime"`
}

type LoginVerifyRequest struct {
	ChallengeID string `json:"challenge_id"`
}

type LoginVerificationPendingResponse struct {
	VerificationRequired bool      `json:"verification_required"`
	ChallengeID          string    `json:"challenge_id"`
	ExpiresAt            time.Time `json:"expires_at"`
}

type LoginVerifyStatusResponse struct {
	Status string `json:"status"`
}

type TelegramStatusResponse struct {
	Connected        bool   `json:"connected"`
	Login2FAEnabled  bool   `json:"login_2fa_enabled"`
	BotUsername      string `json:"bot_username,omitempty"`
	TelegramUsername string `json:"telegram_username,omitempty"`
}

type TelegramConnectResponse struct {
	ConnectURL string    `json:"connect_url"`
	ExpiresAt  time.Time `json:"expires_at"`
}

type TelegramPatchRequest struct {
	Login2FAEnabled *bool `json:"login_2fa_enabled"`
}
