package dto

import "time"

const (
	TBankEnvironmentSandbox    = "sandbox"
	TBankEnvironmentProduction = "production"
)

type TBankAccount struct {
	ID          string     `json:"id"`
	Name        string     `json:"name,omitempty"`
	Type        string     `json:"type,omitempty"`
	Status      string     `json:"status,omitempty"`
	AccessLevel string     `json:"access_level,omitempty"`
	OpenedAt    *time.Time `json:"opened_at,omitempty"`
	ClosedAt    *time.Time `json:"closed_at,omitempty"`
} //@name TBankAccount

type TBankConnectionStatusResponse struct {
	Connected        bool           `json:"connected"`
	Environment      string         `json:"environment,omitempty"`
	TokenMasked      string         `json:"token_masked,omitempty"`
	DefaultAccountID string         `json:"default_account_id,omitempty"`
	Accounts         []TBankAccount `json:"accounts"`
	ConnectionError  string         `json:"connection_error,omitempty"`
} //@name TBankConnectionStatusResponse

type TBankConnectRequest struct {
	Token            string `json:"token" binding:"required"`
	Environment      string `json:"environment" binding:"required,oneof=sandbox production"`
	DefaultAccountID string `json:"default_account_id"`
} //@name TBankConnectRequest

type TBankTestBuyRequest struct {
	AccountID    string `json:"account_id"`
	InstrumentID string `json:"instrument_id" binding:"required"`
	Quantity     int64  `json:"quantity" binding:"required,min=1"`
} //@name TBankTestBuyRequest

type TBankTestBuyResponse struct {
	Environment           string                 `json:"environment"`
	AccountID             string                 `json:"account_id"`
	InstrumentID          string                 `json:"instrument_id"`
	Quantity              int64                  `json:"quantity"`
	OrderID               string                 `json:"order_id,omitempty"`
	ExecutionReportStatus string                 `json:"execution_report_status,omitempty"`
	Response              map[string]interface{} `json:"response,omitempty"`
} //@name TBankTestBuyResponse

type TBankSetDefaultAccountRequest struct {
	AccountID string `json:"account_id" binding:"required"`
} //@name TBankSetDefaultAccountRequest

type TBankSandboxPayInRequest struct {
	AccountID string `json:"account_id"`
	Currency  string `json:"currency"`
	Units     int64  `json:"units"`
} //@name TBankSandboxPayInRequest

type TBankSandboxPayInResponse struct {
	Environment string `json:"environment"`
	AccountID   string `json:"account_id"`
	Currency    string `json:"currency"`
	Units       int64  `json:"units"`
} //@name TBankSandboxPayInResponse

type TBankMoneyBalance struct {
	Currency          string  `json:"currency"`
	Available         float64 `json:"available"`
	Blocked           float64 `json:"blocked"`
	WithdrawAvailable float64 `json:"withdraw_available"`
	WithdrawBlocked   float64 `json:"withdraw_blocked"`
} //@name TBankMoneyBalance

type TBankPortfolioPosition struct {
	Ticker         string  `json:"ticker,omitempty"`
	InstrumentID   string  `json:"instrument_id,omitempty"`
	Figi           string  `json:"figi,omitempty"`
	Name           string  `json:"name,omitempty"`
	InstrumentType string  `json:"instrument_type,omitempty"`
	Quantity       float64 `json:"quantity"`
	CurrentPrice   float64 `json:"current_price"`
	CurrentValue   float64 `json:"current_value"`
	ExpectedYield  float64 `json:"expected_yield"`
	Currency       string  `json:"currency,omitempty"`
} //@name TBankPortfolioPosition

type TBankAccountPortfolioResponse struct {
	Environment                  string                   `json:"environment"`
	AccountID                    string                   `json:"account_id"`
	TotalAmountPortfolio         float64                  `json:"total_amount_portfolio"`
	TotalAmountPortfolioCurrency string                   `json:"total_amount_portfolio_currency,omitempty"`
	DailyYield                   float64                  `json:"daily_yield"`
	DailyYieldRelative           float64                  `json:"daily_yield_relative"`
	Money                        []TBankMoneyBalance      `json:"money"`
	Positions                    []TBankPortfolioPosition `json:"positions"`
} //@name TBankAccountPortfolioResponse

type TBankOperationHistoryItem struct {
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
} //@name TBankOperationHistoryItem

type TBankOperationsHistoryResponse struct {
	Environment string                      `json:"environment"`
	AccountID   string                      `json:"account_id"`
	HasNext     bool                        `json:"has_next"`
	NextCursor  string                      `json:"next_cursor,omitempty"`
	Items       []TBankOperationHistoryItem `json:"items"`
} //@name TBankOperationsHistoryResponse

type TBankInstrumentLookupItem struct {
	InstrumentID      string `json:"instrument_id"`
	Ticker            string `json:"ticker"`
	ClassCode         string `json:"class_code,omitempty"`
	Name              string `json:"name,omitempty"`
	InstrumentType    string `json:"instrument_type,omitempty"`
	Figi              string `json:"figi,omitempty"`
	Uid               string `json:"uid,omitempty"`
	PositionUid       string `json:"position_uid,omitempty"`
	Isin              string `json:"isin,omitempty"`
	Lot               int32  `json:"lot"`
	ApiTradeAvailable bool   `json:"api_trade_available"`
	ForIis            bool   `json:"for_iis"`
	ForQualInvestor   bool   `json:"for_qual_investor"`
} //@name TBankInstrumentLookupItem

type TBankInstrumentLookupResponse struct {
	Query       string                      `json:"query"`
	ClassCode   string                      `json:"class_code,omitempty"`
	Instruments []TBankInstrumentLookupItem `json:"instruments"`
} //@name TBankInstrumentLookupResponse

type TBankPortfolioHistoryPoint struct {
	TradeDate                    string  `json:"trade_date"`
	TotalAmountPortfolio         float64 `json:"total_amount_portfolio"`
	TotalAmountPortfolioCurrency string  `json:"total_amount_portfolio_currency,omitempty"`
} //@name TBankPortfolioHistoryPoint

type TBankPortfolioCompositionEntry struct {
	TradeDate    string  `json:"trade_date"`
	Ticker       string  `json:"ticker"`
	InstrumentID string  `json:"instrument_id"`
	Name         string  `json:"name,omitempty"`
	Quantity     float64 `json:"quantity"`
	CurrentPrice float64 `json:"current_price"`
	CurrentValue float64 `json:"current_value"`
	Currency     string  `json:"currency,omitempty"`
	Weight       float64 `json:"weight"`
} //@name TBankPortfolioCompositionEntry

type TBankPortfolioCompositionSeriesPoint struct {
	TradeDate string  `json:"trade_date"`
	Weight    float64 `json:"weight"`
} //@name TBankPortfolioCompositionSeriesPoint
