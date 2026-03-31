package models

import (
	"time"

	"gorm.io/datatypes"
)

const (
	PortfolioRebalanceExecutionModeManual    = "manual"
	PortfolioRebalanceExecutionModeAutomatic = "automatic"

	PortfolioRebalanceRunStatusDraft              = "draft"
	PortfolioRebalanceRunStatusQueued             = "queued"
	PortfolioRebalanceRunStatusExecuting          = "executing"
	PortfolioRebalanceRunStatusPartiallyCompleted = "partially_completed"
	PortfolioRebalanceRunStatusCompleted          = "completed"
	PortfolioRebalanceRunStatusFailed             = "failed"

	PortfolioRebalanceItemStatusPlanned    = "planned"
	PortfolioRebalanceItemStatusUnresolved = "unresolved"
	PortfolioRebalanceItemStatusExecuting  = "executing"
	PortfolioRebalanceItemStatusCompleted  = "completed"
	PortfolioRebalanceItemStatusFailed     = "failed"

	PortfolioRebalanceItemSideBuy  = "buy"
	PortfolioRebalanceItemSideSell = "sell"
)

type PortfolioRebalanceRun struct {
	ID                            int               `gorm:"primaryKey;autoIncrement"`
	UserID                        int               `gorm:"column:user_id;not null;index:idx_portfolio_rebalance_runs_user_profile_created,priority:1"`
	PortfolioProfileID            int               `gorm:"column:portfolio_profile_id;not null;index:idx_portfolio_rebalance_runs_user_profile_created,priority:2"`
	Provider                      string            `gorm:"column:provider;size:64;not null"`
	BenchmarkSecidSnapshot        *string           `gorm:"column:benchmark_secid_snapshot"`
	ReplicationModeKeySnapshot    string            `gorm:"column:replication_mode_key_snapshot;not null"`
	ReplicationModeParamsSnapshot datatypes.JSONMap `gorm:"column:replication_mode_params_snapshot;type:jsonb;not null;default:'{}'"`
	PlanningParamsSnapshot        datatypes.JSONMap `gorm:"column:planning_params_snapshot;type:jsonb;not null;default:'{}'"`
	ExecutionMode                 string            `gorm:"column:execution_mode;not null;default:manual"`
	ConfirmationRequired          bool              `gorm:"column:confirmation_required;not null;default:true"`
	Status                        string            `gorm:"column:status;not null;default:draft;index:idx_portfolio_rebalance_runs_status"`
	AsOfDate                      time.Time         `gorm:"column:as_of_date;type:date;not null"`
	InputJSON                     datatypes.JSONMap `gorm:"column:input_json;type:jsonb;not null;default:'{}'"`
	OutputJSON                    datatypes.JSONMap `gorm:"column:output_json;type:jsonb;not null;default:'{}'"`
	SummaryJSON                   datatypes.JSONMap `gorm:"column:summary_json;type:jsonb;not null;default:'{}'"`
	WarningsJSON                  datatypes.JSON    `gorm:"column:warnings_json;type:jsonb;not null;default:'[]'"`
	StartedAt                     *time.Time        `gorm:"column:started_at"`
	EndedAt                       *time.Time        `gorm:"column:ended_at"`
	CreatedAt                     time.Time         `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt                     time.Time         `gorm:"column:updated_at;autoUpdateTime"`
}

func (PortfolioRebalanceRun) TableName() string {
	return "portfolio_rebalance_runs"
}
