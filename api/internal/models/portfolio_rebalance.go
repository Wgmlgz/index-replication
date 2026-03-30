package models

import (
	"time"

	"gorm.io/datatypes"
)

const (
	PortfolioRebalanceExecutionModeManual    = "manual"
	PortfolioRebalanceExecutionModeAutomatic = "automatic"

	PortfolioRebalanceRunStatusDraft = "draft"

	PortfolioRebalanceItemStatusPlanned    = "planned"
	PortfolioRebalanceItemStatusUnresolved = "unresolved"

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

type PortfolioRebalanceItem struct {
	ID              int               `gorm:"primaryKey;autoIncrement"`
	RebalanceRunID  int               `gorm:"column:rebalance_run_id;not null;index:idx_portfolio_rebalance_items_run,priority:1;index:idx_portfolio_rebalance_items_run_status,priority:1"`
	Ticker          string            `gorm:"column:ticker;not null;default:''"`
	InstrumentID    string            `gorm:"column:instrument_id;not null;default:''"`
	Side            string            `gorm:"column:side;not null;default:buy"`
	CurrentQuantity float64           `gorm:"column:current_quantity;not null;default:0"`
	TargetQuantity  float64           `gorm:"column:target_quantity;not null;default:0"`
	DeltaQuantity   float64           `gorm:"column:delta_quantity;not null;default:0"`
	CurrentWeight   float64           `gorm:"column:current_weight;not null;default:0"`
	TargetWeight    float64           `gorm:"column:target_weight;not null;default:0"`
	ReferencePrice  *float64          `gorm:"column:reference_price"`
	PlannedAmount   *float64          `gorm:"column:planned_amount"`
	Status          string            `gorm:"column:status;not null;default:planned;index:idx_portfolio_rebalance_items_run_status,priority:2"`
	MetadataJSON    datatypes.JSONMap `gorm:"column:metadata_json;type:jsonb;not null;default:'{}'"`
	CreatedAt       time.Time         `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt       time.Time         `gorm:"column:updated_at;autoUpdateTime"`
}

func (PortfolioRebalanceItem) TableName() string {
	return "portfolio_rebalance_items"
}

type PortfolioRebalanceExecutionLink struct {
	ID                      int               `gorm:"primaryKey;autoIncrement"`
	RebalanceRunID          int               `gorm:"column:rebalance_run_id;not null;index:idx_portfolio_rebalance_execution_links_run,priority:1"`
	RebalanceItemID         *int              `gorm:"column:rebalance_item_id"`
	ProviderOperationID     *string           `gorm:"column:provider_operation_id"`
	ProviderOperationCursor *string           `gorm:"column:provider_operation_cursor"`
	Status                  string            `gorm:"column:status;not null;default:pending"`
	MetadataJSON            datatypes.JSONMap `gorm:"column:metadata_json;type:jsonb;not null;default:'{}'"`
	CreatedAt               time.Time         `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt               time.Time         `gorm:"column:updated_at;autoUpdateTime"`
}

func (PortfolioRebalanceExecutionLink) TableName() string {
	return "portfolio_rebalance_execution_links"
}

type PortfolioRebalanceConfirmationRecord struct {
	ID               int               `gorm:"primaryKey;autoIncrement"`
	RebalanceRunID   int               `gorm:"column:rebalance_run_id;not null;index:idx_portfolio_rebalance_confirmation_records_run,priority:1"`
	ConfirmationType string            `gorm:"column:confirmation_type;not null"`
	Status           string            `gorm:"column:status;not null;default:pending"`
	RequestedBy      *int              `gorm:"column:requested_by"`
	ConfirmedBy      *int              `gorm:"column:confirmed_by"`
	PayloadJSON      datatypes.JSONMap `gorm:"column:payload_json;type:jsonb;not null;default:'{}'"`
	CreatedAt        time.Time         `gorm:"column:created_at;autoCreateTime"`
	UpdatedAt        time.Time         `gorm:"column:updated_at;autoUpdateTime"`
}

func (PortfolioRebalanceConfirmationRecord) TableName() string {
	return "portfolio_rebalance_confirmation_records"
}
