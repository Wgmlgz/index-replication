package models

import "time"

const (
	TBankEnvironmentSandbox    = "sandbox"
	TBankEnvironmentProduction = "production"
)

// TBankAccount represents a single account from UsersService_GetAccounts.
// swagger:model
type TBankAccount struct {
	ID          string     `json:"id"`
	Name        string     `json:"name,omitempty"`
	Type        string     `json:"type,omitempty"`
	Status      string     `json:"status,omitempty"`
	AccessLevel string     `json:"access_level,omitempty"`
	OpenedAt    *time.Time `json:"opened_at,omitempty"`
	ClosedAt    *time.Time `json:"closed_at,omitempty"`
}

// TBankConnectionStatusResponse represents current T-Bank integration state.
// swagger:model
type TBankConnectionStatusResponse struct {
	Connected        bool           `json:"connected"`
	Environment      string         `json:"environment,omitempty"`
	TokenMasked      string         `json:"token_masked,omitempty"`
	DefaultAccountID string         `json:"default_account_id,omitempty"`
	Accounts         []TBankAccount `json:"accounts"`
	ConnectionError  string         `json:"connection_error,omitempty"`
}

// TBankConnectRequest contains user token + environment to connect.
// swagger:model
type TBankConnectRequest struct {
	Token            string `json:"token" binding:"required"`
	Environment      string `json:"environment" binding:"required,oneof=sandbox production"`
	DefaultAccountID string `json:"default_account_id"`
}

// TBankTestBuyRequest places a simple market buy order for testing.
// swagger:model
type TBankTestBuyRequest struct {
	AccountID    string `json:"account_id"`
	InstrumentID string `json:"instrument_id" binding:"required"`
	Quantity     int64  `json:"quantity" binding:"required,min=1"`
}

// TBankTestBuyResponse exposes essential order submission details.
// swagger:model
type TBankTestBuyResponse struct {
	Environment           string                 `json:"environment"`
	AccountID             string                 `json:"account_id"`
	InstrumentID          string                 `json:"instrument_id"`
	Quantity              int64                  `json:"quantity"`
	OrderID               string                 `json:"order_id,omitempty"`
	ExecutionReportStatus string                 `json:"execution_report_status,omitempty"`
	Response              map[string]interface{} `json:"response,omitempty"`
}

// TBankSetDefaultAccountRequest updates selected default account.
// swagger:model
type TBankSetDefaultAccountRequest struct {
	AccountID string `json:"account_id" binding:"required"`
}

// TBankSandboxPayInRequest performs sandbox balance top-up.
// swagger:model
type TBankSandboxPayInRequest struct {
	AccountID string `json:"account_id"`
	Currency  string `json:"currency"`
	Units     int64  `json:"units"`
}

// TBankSandboxPayInResponse is returned after sandbox top-up.
// swagger:model
type TBankSandboxPayInResponse struct {
	Environment string `json:"environment"`
	AccountID   string `json:"account_id"`
	Currency    string `json:"currency"`
	Units       int64  `json:"units"`
}

// TBankMoneyBalance represents account money and withdraw balances by currency.
// swagger:model
type TBankMoneyBalance struct {
	Currency          string  `json:"currency"`
	Available         float64 `json:"available"`
	Blocked           float64 `json:"blocked"`
	WithdrawAvailable float64 `json:"withdraw_available"`
	WithdrawBlocked   float64 `json:"withdraw_blocked"`
}

// TBankPortfolioPosition represents one portfolio position.
// swagger:model
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
}

// TBankAccountPortfolioResponse contains account-level balance snapshot.
// swagger:model
type TBankAccountPortfolioResponse struct {
	Environment                  string                   `json:"environment"`
	AccountID                    string                   `json:"account_id"`
	TotalAmountPortfolio         float64                  `json:"total_amount_portfolio"`
	TotalAmountPortfolioCurrency string                   `json:"total_amount_portfolio_currency,omitempty"`
	DailyYield                   float64                  `json:"daily_yield"`
	DailyYieldRelative           float64                  `json:"daily_yield_relative"`
	Money                        []TBankMoneyBalance      `json:"money"`
	Positions                    []TBankPortfolioPosition `json:"positions"`
}

// TBankInstrumentLookupItem contains one lookup candidate.
// swagger:model
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
}

// TBankInstrumentLookupResponse contains ticker lookup results.
// swagger:model
type TBankInstrumentLookupResponse struct {
	Query       string                      `json:"query"`
	ClassCode   string                      `json:"class_code,omitempty"`
	Instruments []TBankInstrumentLookupItem `json:"instruments"`
}
