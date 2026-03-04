package dto

import "time"

type PortfolioProviderAction struct {
	ID    string `json:"id"`
	Label string `json:"label"`
} //@name PortfolioProviderAction

type PortfolioCapabilities struct {
	Actions []PortfolioProviderAction `json:"actions"`
} //@name PortfolioCapabilities

type PortfolioProfile struct {
	ID           int                    `json:"id"`
	Provider     string                 `json:"provider"`
	Name         string                 `json:"name"`
	IsDefault    bool                   `json:"is_default"`
	Config       map[string]interface{} `json:"config"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	Capabilities PortfolioCapabilities  `json:"capabilities"`
} //@name PortfolioProfile

type PortfolioProfileCreateRequest struct {
	Provider  string                 `json:"provider" binding:"required"`
	Name      string                 `json:"name" binding:"required"`
	IsDefault bool                   `json:"is_default"`
	Config    map[string]interface{} `json:"config"`
	Secret    map[string]interface{} `json:"secret"`
} //@name PortfolioProfileCreateRequest

type PortfolioProfilePatchRequest struct {
	Name      *string                 `json:"name"`
	IsDefault *bool                   `json:"is_default"`
	Config    *map[string]interface{} `json:"config"`
	Secret    *map[string]interface{} `json:"secret"`
} //@name PortfolioProfilePatchRequest

type PortfolioSummaryMoneyBalance struct {
	Currency          string  `json:"currency"`
	Available         float64 `json:"available"`
	Blocked           float64 `json:"blocked"`
	WithdrawAvailable float64 `json:"withdraw_available"`
	WithdrawBlocked   float64 `json:"withdraw_blocked"`
} //@name PortfolioSummaryMoneyBalance

type PortfolioSummaryPosition struct {
	Ticker         string  `json:"ticker,omitempty"`
	InstrumentID   string  `json:"instrument_id,omitempty"`
	Name           string  `json:"name,omitempty"`
	InstrumentType string  `json:"instrument_type,omitempty"`
	Quantity       float64 `json:"quantity"`
	CurrentPrice   float64 `json:"current_price"`
	CurrentValue   float64 `json:"current_value"`
	ExpectedYield  float64 `json:"expected_yield"`
	Currency       string  `json:"currency,omitempty"`
} //@name PortfolioSummaryPosition

type PortfolioSummaryResponse struct {
	PortfolioID          int                            `json:"portfolio_id"`
	Provider             string                         `json:"provider"`
	Name                 string                         `json:"name"`
	TotalAmountPortfolio float64                        `json:"total_amount_portfolio"`
	TotalAmountCurrency  string                         `json:"total_amount_currency,omitempty"`
	DailyYield           float64                        `json:"daily_yield"`
	DailyYieldRelative   float64                        `json:"daily_yield_relative"`
	Money                []PortfolioSummaryMoneyBalance `json:"money"`
	Positions            []PortfolioSummaryPosition     `json:"positions"`
	Capabilities         PortfolioCapabilities          `json:"capabilities"`
} //@name PortfolioSummaryResponse

type PortfolioHistoryPoint struct {
	TradeDate            string  `json:"trade_date"`
	TotalAmountPortfolio float64 `json:"total_amount_portfolio"`
	Currency             string  `json:"currency,omitempty"`
} //@name PortfolioHistoryPoint

type PortfolioCompositionEntry struct {
	TradeDate    string  `json:"trade_date"`
	Ticker       string  `json:"ticker"`
	InstrumentID string  `json:"instrument_id"`
	Name         string  `json:"name,omitempty"`
	Quantity     float64 `json:"quantity"`
	CurrentPrice float64 `json:"current_price"`
	CurrentValue float64 `json:"current_value"`
	Currency     string  `json:"currency,omitempty"`
	Weight       float64 `json:"weight"`
} //@name PortfolioCompositionEntry

type PortfolioCompositionSeriesPoint struct {
	TradeDate string  `json:"trade_date"`
	Weight    float64 `json:"weight"`
} //@name PortfolioCompositionSeriesPoint

type PortfolioOperationHistoryItem struct {
	Cursor             string     `json:"cursor,omitempty"`
	ID                 string     `json:"id,omitempty"`
	ParentOperationID  string     `json:"parent_operation_id,omitempty"`
	Date               *time.Time `json:"date,omitempty"`
	Type               string     `json:"type,omitempty"`
	State              string     `json:"state,omitempty"`
	Name               string     `json:"name,omitempty"`
	Description        string     `json:"description,omitempty"`
	InstrumentID       string     `json:"instrument_id,omitempty"`
	Figi               string     `json:"figi,omitempty"`
	InstrumentType     string     `json:"instrument_type,omitempty"`
	Quantity           int64      `json:"quantity"`
	QuantityDone       int64      `json:"quantity_done"`
	QuantityRest       int64      `json:"quantity_rest"`
	Payment            float64    `json:"payment"`
	PaymentCurrency    string     `json:"payment_currency,omitempty"`
	Price              float64    `json:"price"`
	PriceCurrency      string     `json:"price_currency,omitempty"`
	Commission         float64    `json:"commission"`
	CommissionCurrency string     `json:"commission_currency,omitempty"`
} //@name PortfolioOperationHistoryItem

type PortfolioOperationsHistoryResponse struct {
	PortfolioID int                             `json:"portfolio_id"`
	Provider    string                          `json:"provider"`
	HasNext     bool                            `json:"has_next"`
	NextCursor  string                          `json:"next_cursor,omitempty"`
	Items       []PortfolioOperationHistoryItem `json:"items"`
} //@name PortfolioOperationsHistoryResponse

type PortfolioActionRequest struct {
	Payload map[string]interface{} `json:"payload"`
} //@name PortfolioActionRequest

type PortfolioActionResponse struct {
	Action string                 `json:"action"`
	Result map[string]interface{} `json:"result,omitempty"`
} //@name PortfolioActionResponse
