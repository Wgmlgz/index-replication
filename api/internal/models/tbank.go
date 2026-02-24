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
