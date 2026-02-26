package models

import "time"

type MoexIndexDB struct {
	Secid      string    `gorm:"column:secid;primaryKey"`
	ShortName  string    `gorm:"column:short_name;not null"`
	Name       string    `gorm:"column:name;not null"`
	Currency   *string   `gorm:"column:currency"`
	Decimals   *int      `gorm:"column:decimals"`
	BoardID    *string   `gorm:"column:board_id"`
	CalcMode   *string   `gorm:"column:calc_mode"`
	AnnualHigh *float64  `gorm:"column:annual_high"`
	AnnualLow  *float64  `gorm:"column:annual_low"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (MoexIndexDB) TableName() string {
	return "moex_indexes"
}

type MoexIndexCollectionDB struct {
	ID              int       `gorm:"column:id;primaryKey"`
	Name            string    `gorm:"column:name;not null"`
	Title           string    `gorm:"column:title;not null"`
	SecurityGroupID *int      `gorm:"column:security_group_id"`
	UpdatedAt       time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (MoexIndexCollectionDB) TableName() string {
	return "moex_index_collections"
}

type MoexIndexCollectionMembershipDB struct {
	Secid          string    `gorm:"column:secid;primaryKey"`
	CollectionName string    `gorm:"column:collection_name;primaryKey"`
	UpdatedAt      time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

func (MoexIndexCollectionMembershipDB) TableName() string {
	return "moex_index_collection_memberships"
}

type MoexIndexHistoryDailyDB struct {
	Secid           string     `gorm:"column:secid;primaryKey"`
	TradeDate       time.Time  `gorm:"column:trade_date;primaryKey;type:date"`
	Open            *float64   `gorm:"column:open"`
	High            *float64   `gorm:"column:high"`
	Low             *float64   `gorm:"column:low"`
	Close           *float64   `gorm:"column:close"`
	SourceUpdatedAt *time.Time `gorm:"column:source_updated_at"`
	IngestedAt      time.Time  `gorm:"column:ingested_at;autoCreateTime"`
}

func (MoexIndexHistoryDailyDB) TableName() string {
	return "moex_index_history_daily"
}

type MoexIndexCompositionDailyDB struct {
	IndexID          string     `gorm:"column:index_id;primaryKey"`
	TradeDate        time.Time  `gorm:"column:trade_date;primaryKey;type:date"`
	Ticker           string     `gorm:"column:ticker;primaryKey"`
	SecID            *string    `gorm:"column:secid"`
	ShortName        *string    `gorm:"column:short_name"`
	Weight           *float64   `gorm:"column:weight"`
	TradeSessionDate *time.Time `gorm:"column:trade_session_date;type:date"`
	IngestedAt       time.Time  `gorm:"column:ingested_at;autoCreateTime"`
}

func (MoexIndexCompositionDailyDB) TableName() string {
	return "moex_index_composition_daily"
}

type MoexSyncState struct {
	Dataset             string     `gorm:"column:dataset"`
	EntityKey           string     `gorm:"column:entity_key"`
	CheckedThroughDate  *time.Time `gorm:"column:checked_through_date"`
	ImmutableBeforeDate *time.Time `gorm:"column:immutable_before_date"`
	MutableSinceDate    *time.Time `gorm:"column:mutable_since_date"`
}

type MoexIncompleteCoverageRange struct {
	FromDate time.Time `gorm:"column:from_date"`
	ToDate   time.Time `gorm:"column:to_date"`
}

type MoexCoverageRange struct {
	FromDate time.Time
	ToDate   time.Time
}

type MoexSyncStateRow struct {
	Dataset             string     `gorm:"column:dataset"`
	EntityKey           string     `gorm:"column:entity_key"`
	CheckedThroughDate  *time.Time `gorm:"column:checked_through_date"`
	ImmutableBeforeDate *time.Time `gorm:"column:immutable_before_date"`
	MutableSinceDate    *time.Time `gorm:"column:mutable_since_date"`
	Status              string     `gorm:"column:status"`
	LastSuccessAt       *time.Time `gorm:"column:last_success_at"`
	LastAttemptAt       *time.Time `gorm:"column:last_attempt_at"`
	RetryCount          int        `gorm:"column:retry_count"`
	LastError           *string    `gorm:"column:last_error"`
	UpdatedAt           time.Time  `gorm:"column:updated_at"`
}

type MoexCoverageRow struct {
	Dataset    string    `gorm:"column:dataset"`
	EntityKey  string    `gorm:"column:entity_key"`
	FromDate   time.Time `gorm:"column:from_date"`
	ToDate     time.Time `gorm:"column:to_date"`
	IsComplete bool      `gorm:"column:is_complete"`
	UpdatedAt  time.Time `gorm:"column:updated_at"`
}

type MoexSyncRunRow struct {
	RunID         string     `gorm:"column:run_id"`
	WorkflowID    *string    `gorm:"column:workflow_id"`
	WorkflowRunID *string    `gorm:"column:workflow_run_id"`
	Dataset       string     `gorm:"column:dataset"`
	EntityKey     string     `gorm:"column:entity_key"`
	Status        string     `gorm:"column:status"`
	StartedAt     time.Time  `gorm:"column:started_at"`
	FinishedAt    *time.Time `gorm:"column:finished_at"`
	FetchedRows   int        `gorm:"column:fetched_rows"`
	UpsertedRows  int        `gorm:"column:upserted_rows"`
	ErrorText     *string    `gorm:"column:error_text"`
	Details       *string    `gorm:"column:details"`
}

type MoexCompositionSeriesRow struct {
	Ticker    string
	TradeDate time.Time
	Weight    *float64
}

type MoexCoverageScanRow struct {
	FromDate   time.Time `gorm:"column:from_date"`
	ToDate     time.Time `gorm:"column:to_date"`
	IsComplete bool      `gorm:"column:is_complete"`
}

type MoexOverviewIndexRow struct {
	Secid          string     `gorm:"column:secid"`
	ShortName      string     `gorm:"column:short_name"`
	Name           string     `gorm:"column:name"`
	Currency       *string    `gorm:"column:currency"`
	Decimals       *int       `gorm:"column:decimals"`
	BoardID        *string    `gorm:"column:board_id"`
	CalcMode       *string    `gorm:"column:calc_mode"`
	AnnualHigh     *float64   `gorm:"column:annual_high"`
	AnnualLow      *float64   `gorm:"column:annual_low"`
	LastActiveDate *time.Time `gorm:"column:last_active_date"`
	HasComposition bool       `gorm:"column:has_composition"`
}

type MoexHistoryPointRow struct {
	TradeDate time.Time `gorm:"column:trade_date"`
	Open      *float64  `gorm:"column:open"`
	High      *float64  `gorm:"column:high"`
	Low       *float64  `gorm:"column:low"`
	Close     *float64  `gorm:"column:close"`
}

type MoexMaxTradeDateRow struct {
	TradeDate *time.Time `gorm:"column:trade_date"`
}
