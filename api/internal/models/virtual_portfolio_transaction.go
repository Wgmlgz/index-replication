package models

import "time"

type VirtualPortfolioTransaction struct {
	ID                 int       `gorm:"primaryKey;autoIncrement"`
	UserID             int       `gorm:"index;not null"`
	PortfolioProfileID int       `gorm:"index;not null"`
	OperationType      string    `gorm:"size:64;not null"`
	Ticker             string    `gorm:"size:64"`
	InstrumentID       string    `gorm:"size:128"`
	Quantity           float64   `gorm:"not null;default:0"`
	Price              float64   `gorm:"not null;default:0"`
	Amount             float64   `gorm:"not null;default:0"`
	Currency           string    `gorm:"size:16;not null;default:RUB"`
	Commission         float64   `gorm:"not null;default:0"`
	ExecutedAt         time.Time `gorm:"index;not null"`
	CreatedAt          time.Time `gorm:"autoCreateTime"`
}

func (VirtualPortfolioTransaction) TableName() string {
	return "virtual_portfolio_transactions"
}
