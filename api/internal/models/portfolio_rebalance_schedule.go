package models

import "time"

type PortfolioRebalanceSchedule struct {
	ID                 int       `gorm:"primaryKey;autoIncrement"`
	PortfolioProfileID int       `gorm:"column:portfolio_profile_id;not null;uniqueIndex"`
	IsEnabled          bool      `gorm:"column:is_enabled;not null;default:true"`
	DtStart            time.Time `gorm:"column:dtstart;not null"`
	RRule              string    `gorm:"column:rrule;type:text;not null"`
	CreatedAt          time.Time `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt          time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (PortfolioRebalanceSchedule) TableName() string {
	return "portfolio_rebalance_schedules"
}
