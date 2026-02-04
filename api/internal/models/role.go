package models

type Role struct {
	ID          int    `gorm:"primaryKey;autoIncrement"`
	Key         string `gorm:"size:50"`
	Name        string `gorm:"size:50"`
	Description string `gorm:"type:text"`
}
