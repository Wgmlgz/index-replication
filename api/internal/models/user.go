package models

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID           int    `gorm:"primaryKey;autoIncrement"`
	Username     string `gorm:"uniqueIndex;not null;size:255"`
	PasswordHash string `gorm:"not null;size:60"`
	FullName     string `gorm:"not null;size:255"`
	RoleID       int    `gorm:"not null"`
	Phone        string `gorm:"size:50"`
	Email        string `gorm:"size:255"`
	LastActive   *time.Time
	BlockedAt    *time.Time
	CreatedAt    time.Time `gorm:"autoCreateTime"`
	Role         *Role     `gorm:"foreignKey:RoleID"`
	Comment      string    `gorm:"type:text"`
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
