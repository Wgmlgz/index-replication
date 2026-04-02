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
	StartedAt            *time.Time             `json:"started_at"`
	EndedAt              *time.Time             `json:"ended_at"`
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
} //@name PortfolioRebalanceRun

type PortfolioRebalancePlanningParams struct {
	QuantityPrecision int `json:"quantity_precision"`
} //@name PortfolioRebalancePlanningParams

type PortfolioRebalanceHolding struct {
	Ticker          string  `json:"ticker"`
	InstrumentID    string  `json:"instrument_id"`
	CurrentQuantity float64 `json:"current_quantity"`
} //@name PortfolioRebalanceHolding

type PortfolioRebalanceBenchmarkConstituent struct {
	Ticker       string  `json:"ticker"`
	InstrumentID string  `json:"instrument_id"`
	TargetWeight float64 `json:"target_weight"`
} //@name PortfolioRebalanceBenchmarkConstituent

type PortfolioRebalanceMoney struct {
	Currency  string  `json:"currency"`
	Available float64 `json:"available"`
	Blocked   float64 `json:"blocked"`
} //@name PortfolioRebalanceMoney

type PortfolioRebalanceInstrumentInfo struct {
	Ticker       string    `json:"ticker"`
	InstrumentID string    `json:"instrument_id"`
	Price        float64   `json:"price"`
	Currency     string    `json:"currency"`
	AsOfAt       time.Time `json:"as_of_at"`
	Source       string    `json:"source"`
	LotSize      int64     `json:"lot_size"`
} //@name PortfolioRebalanceInstrumentInfo

type PortfolioRebalanceInput struct {
	AsOfAt            time.Time                                `json:"as_of_at"`
	ModeKey           string                                   `json:"mode_key"`
	ModeParams        map[string]interface{}                   `json:"mode_params"`
	InvestableCapital float64                                  `json:"investable_capital"`
	Holdings          []PortfolioRebalanceHolding              `json:"holdings"`
	Benchmark         []PortfolioRebalanceBenchmarkConstituent `json:"benchmark"`
	Instruments       []PortfolioRebalanceInstrumentInfo       `json:"instruments"`
	Money             []PortfolioRebalanceMoney                `json:"money"`
	Params            PortfolioRebalancePlanningParams         `json:"params"`
} //@name PortfolioRebalanceInput

type PortfolioRebalanceItem struct {
	Ticker          string                 `json:"ticker"`
	InstrumentID    string                 `json:"instrument_id"`
	Side            string                 `json:"side"`
	CurrentQuantity float64                `json:"current_quantity"`
	TargetQuantity  float64                `json:"target_quantity"`
	DeltaQuantity   float64                `json:"delta_quantity"`
	CurrentWeight   float64                `json:"current_weight"`
	TargetWeight    float64                `json:"target_weight"`
	IdealWeight     float64                `json:"ideal_weight"`
	ReferencePrice  *float64               `json:"reference_price"`
	PlannedAmount   *float64               `json:"planned_amount"`
	Status          string                 `json:"status"`
	Metadata        map[string]interface{} `json:"metadata"`
} //@name PortfolioRebalanceItem

type PortfolioRebalanceOutput struct {
	Items    []PortfolioRebalanceItem  `json:"items"`
	Warnings []string                  `json:"warnings"`
	Money    []PortfolioRebalanceMoney `json:"money"`
} //@name PortfolioRebalanceOutput

type PortfolioRebalanceSummary struct {
	ItemsTotal           int     `json:"items_total"`
	ActionableItems      int     `json:"actionable_items"`
	UnresolvedItems      int     `json:"unresolved_items"`
	FilteredZeroDelta    int     `json:"filtered_zero_delta"`
	EstimatedTurnoverAbs float64 `json:"estimated_turnover_abs"`
	InvestableCapital    float64 `json:"investable_capital"`
} //@name PortfolioRebalanceSummary

type PortfolioRebalanceTransaction struct {
	Sequence     int      `json:"sequence"`
	Ticker       string   `json:"ticker"`
	InstrumentID string   `json:"instrument_id"`
	Side         string   `json:"side"`
	Quantity     float64  `json:"quantity"`
	Price        *float64 `json:"price"`
	Amount       *float64 `json:"amount"`
	Currency     string   `json:"currency"`
	LotSize      int64    `json:"lot_size"`
} //@name PortfolioRebalanceTransaction

type PortfolioRebalanceDetailResponse struct {
	Run          PortfolioRebalanceRun           `json:"run"`
	Input        PortfolioRebalanceInput         `json:"input"`
	Output       PortfolioRebalanceOutput        `json:"output"`
	Summary      PortfolioRebalanceSummary       `json:"summary"`
	Transactions []PortfolioRebalanceTransaction `json:"transactions"`
} //@name PortfolioRebalanceDetailResponse

type PortfolioRebalanceExecutionProgress struct {
	TotalItems        int        `json:"total_items"`
	ActionableItems   int        `json:"actionable_items"`
	UnresolvedItems   int        `json:"unresolved_items"`
	PendingItems      int        `json:"pending_items"`
	ExecutingItems    int        `json:"executing_items"`
	CompletedItems    int        `json:"completed_items"`
	FailedItems       int        `json:"failed_items"`
	CompletionPercent float64    `json:"completion_percent"`
	IsTerminal        bool       `json:"is_terminal"`
	LastEventAt       *time.Time `json:"last_event_at"`
} //@name PortfolioRebalanceExecutionProgress

type PortfolioRebalanceExecutionItem struct {
	ID                  int        `json:"id"`
	Ticker              string     `json:"ticker"`
	InstrumentID        string     `json:"instrument_id"`
	Side                string     `json:"side"`
	CurrentQuantity     float64    `json:"current_quantity"`
	TargetQuantity      float64    `json:"target_quantity"`
	DeltaQuantity       float64    `json:"delta_quantity"`
	ReferencePrice      *float64   `json:"reference_price"`
	PlannedAmount       *float64   `json:"planned_amount"`
	Status              string     `json:"status"`
	LastError           *string    `json:"last_error"`
	LastActionID        *string    `json:"last_action_id"`
	ProviderOperationID *string    `json:"provider_operation_id"`
	UpdatedAt           time.Time  `json:"updated_at"`
	LastEventAt         *time.Time `json:"last_event_at"`
} //@name PortfolioRebalanceExecutionItem

type PortfolioRebalanceExecutionLink struct {
	ID                      int                    `json:"id"`
	RebalanceItemID         *int                   `json:"rebalance_item_id"`
	Status                  string                 `json:"status"`
	ProviderOperationID     *string                `json:"provider_operation_id"`
	ProviderOperationCursor *string                `json:"provider_operation_cursor"`
	Metadata                map[string]interface{} `json:"metadata"`
	CreatedAt               time.Time              `json:"created_at"`
	UpdatedAt               time.Time              `json:"updated_at"`
} //@name PortfolioRebalanceExecutionLink

type PortfolioRebalanceExecutionStatusResponse struct {
	Run      PortfolioRebalanceRun               `json:"run"`
	Progress PortfolioRebalanceExecutionProgress `json:"progress"`
	Items    []PortfolioRebalanceExecutionItem   `json:"items"`
	Links    []PortfolioRebalanceExecutionLink   `json:"links"`
} //@name PortfolioRebalanceExecutionStatusResponse
