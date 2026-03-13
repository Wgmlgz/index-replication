package dto

import "time"

type PortfolioRebalanceCreateRequest struct {
	ExecutionMode        string                 `json:"execution_mode"`
	ConfirmationRequired *bool                  `json:"confirmation_required"`
	AsOfDate             string                 `json:"as_of_date"`
	PlanningParams       map[string]interface{} `json:"planning_params"`
} //@name PortfolioRebalanceCreateRequest

type PortfolioRebalanceRun struct {
	ID                   int                    `json:"id"`
	PortfolioID          int                    `json:"portfolio_id"`
	Provider             string                 `json:"provider"`
	BenchmarkSecid       *string                `json:"benchmark_secid"`
	ModeKey              string                 `json:"mode_key"`
	ModeParams           map[string]interface{} `json:"mode_params"`
	PlanningParams       map[string]interface{} `json:"planning_params"`
	ExecutionMode        string                 `json:"execution_mode"`
	ConfirmationRequired bool                   `json:"confirmation_required"`
	Status               string                 `json:"status"`
	AsOfDate             string                 `json:"as_of_date"`
	Summary              map[string]interface{} `json:"summary"`
	Warnings             []string               `json:"warnings"`
	StartedAt            *time.Time             `json:"started_at"`
	EndedAt              *time.Time             `json:"ended_at"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
} //@name PortfolioRebalanceRun

type PortfolioRebalanceItem struct {
	ID              int                    `json:"id"`
	RebalanceRunID  int                    `json:"rebalance_run_id"`
	Ticker          string                 `json:"ticker"`
	InstrumentID    string                 `json:"instrument_id"`
	Side            string                 `json:"side"`
	CurrentQuantity float64                `json:"current_quantity"`
	TargetQuantity  float64                `json:"target_quantity"`
	DeltaQuantity   float64                `json:"delta_quantity"`
	CurrentWeight   float64                `json:"current_weight"`
	TargetWeight    float64                `json:"target_weight"`
	ReferencePrice  *float64               `json:"reference_price"`
	PlannedAmount   *float64               `json:"planned_amount"`
	Status          string                 `json:"status"`
	Metadata        map[string]interface{} `json:"metadata"`
} //@name PortfolioRebalanceItem

type PortfolioRebalanceDetailResponse struct {
	Run   PortfolioRebalanceRun    `json:"run"`
	Items []PortfolioRebalanceItem `json:"items"`
} //@name PortfolioRebalanceDetailResponse
