package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID          int     `gorm:"primaryKey;autoIncrement"`
	Username    string  `gorm:"uniqueIndex;not null;size:255"`
	KeycloakSub *string `gorm:"uniqueIndex;size:255"`
	FullName    string  `gorm:"not null;size:255"`
	RoleID      int     `gorm:"not null"`
	LastActive  *time.Time
	BlockedAt   *time.Time
	CreatedAt   time.Time `gorm:"autoCreateTime"`
	Role        *Role     `gorm:"foreignKey:RoleID"`
	Comment     string    `gorm:"type:text"`
}

// BeforeCreate is a GORM hook that will be called before creating a record
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.CreatedAt.IsZero() {
		u.CreatedAt = time.Now()
	}
	return nil
}
