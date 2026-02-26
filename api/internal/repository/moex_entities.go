package repository

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
