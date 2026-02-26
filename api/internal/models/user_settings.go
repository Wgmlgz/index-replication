package models

import "time"

type UserSetting struct {
	ID        int       `gorm:"primaryKey;autoIncrement"`
	UserID    int       `gorm:"index;not null"`
	Key       string    `gorm:"size:255;not null"`
	Value     string    `gorm:"type:text;not null"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

type UserFavoriteIndex struct {
	ID        int       `gorm:"primaryKey;autoIncrement"`
	UserID    int       `gorm:"index;not null"`
	SecID     string    `gorm:"size:64;not null"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
}

type UserFavoriteIndexRow struct {
	SecID string `gorm:"column:secid"`
}

type UserSettingKVRow struct {
	Key   string
	Value string
}
