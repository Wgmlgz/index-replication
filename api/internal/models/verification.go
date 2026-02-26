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
