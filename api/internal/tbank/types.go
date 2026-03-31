package tbank

import "time"

type MarketOrderRequest struct {
	AccountID    string
	InstrumentID string
	Quantity     int64
	ActionID     string
}

type MarketOrderResponse struct {
	Environment           string
	AccountID             string
	InstrumentID          string
	Quantity              int64
	OrderID               string
	ExecutionReportStatus string
	Response              map[string]interface{}
}

type ResolveOrderInstrumentRequest struct {
	AccountID    string
	Ticker       string
	InstrumentID string
	Side         string
}

type ResolveOrderInstrumentResponse struct {
	Environment  string
	AccountID    string
	Ticker       string
	InstrumentID string
	Source       string
}

type SandboxPayInRequest struct {
	AccountID string
	Currency  string
	Units     int64
}

type SandboxPayInResponse struct {
	Environment string
	AccountID   string
	Currency    string
	Units       int64
}

type SandboxPayOutRequest struct {
	AccountID string
	Currency  string
	Units     int64
}

type SandboxPayOutResponse struct {
	Environment string
	AccountID   string
	Currency    string
	Units       int64
}

type MoneyBalance struct {
	Currency          string
	Available         float64
	Blocked           float64
	WithdrawAvailable float64
	WithdrawBlocked   float64
}

type PortfolioPosition struct {
	Ticker         string
	InstrumentID   string
	Figi           string
	Name           string
	InstrumentType string
	Quantity       float64
	CurrentPrice   float64
	CurrentValue   float64
	ExpectedYield  float64
	Currency       string
}

type AccountPortfolioResponse struct {
	Environment                  string
	AccountID                    string
	TotalAmountPortfolio         float64
	TotalAmountPortfolioCurrency string
	DailyYield                   float64
	DailyYieldRelative           float64
	Money                        []MoneyBalance
	Positions                    []PortfolioPosition
}

type OperationHistoryItem struct {
	Cursor             string
	ID                 string
	ParentOperationID  string
	Date               *time.Time
	Type               string
	State              string
	Name               string
	Description        string
	InstrumentID       string
	Figi               string
	InstrumentType     string
	Quantity           int64
	QuantityDone       int64
	QuantityRest       int64
	Payment            float64
	PaymentCurrency    string
	Price              float64
	PriceCurrency      string
	Commission         float64
	CommissionCurrency string
}

type OperationsHistoryResponse struct {
	Environment string
	AccountID   string
	HasNext     bool
	NextCursor  string
	Items       []OperationHistoryItem
}

type PortfolioHistoryPoint struct {
	TradeDate                    string
	TotalAmountPortfolio         float64
	TotalAmountPortfolioCurrency string
}

type PortfolioCompositionEntry struct {
	TradeDate    string
	Ticker       string
	InstrumentID string
	Name         string
	Quantity     float64
	CurrentPrice float64
	CurrentValue float64
	Currency     string
	Weight       float64
}

type PortfolioCompositionSeriesPoint struct {
	TradeDate string
	Weight    float64
}
