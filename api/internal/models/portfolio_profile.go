package models

import "time"

type PortfolioProfile struct {
	ID         int       `gorm:"primaryKey;autoIncrement"`
	UserID     int       `gorm:"index;not null"`
	Provider   string    `gorm:"size:64;not null"`
	Name       string    `gorm:"size:255;not null"`
	IsDefault  bool      `gorm:"index;not null;default:false"`
	ConfigJSON string    `gorm:"type:text;not null;default:{}"`
	SecretJSON string    `gorm:"type:text;not null;default:{}"`
	CreatedAt  time.Time `gorm:"autoCreateTime"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime"`
}
