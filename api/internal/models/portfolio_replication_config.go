package models

import (
	"time"

	"gorm.io/datatypes"
)

type PortfolioReplicationConfig struct {
	ID                 int               `gorm:"primaryKey;autoIncrement"`
	PortfolioProfileID int               `gorm:"column:portfolio_profile_id;not null;uniqueIndex"`
	IsEnabled          bool              `gorm:"column:is_enabled;not null;default:false"`
	BenchmarkSecid     *string           `gorm:"column:benchmark_secid"`
	ModeKey            string            `gorm:"column:mode_key;not null;default:full"`
	ModeParams         datatypes.JSONMap `gorm:"column:mode_params;type:jsonb;not null;default:'{}'"`
	CreatedAt          time.Time         `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt          time.Time         `gorm:"column:updated_at;autoUpdateTime"`
}

func (PortfolioReplicationConfig) TableName() string {
	return "portfolio_replication_configs"
}
