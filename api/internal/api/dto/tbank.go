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

type TBankSetDefaultAccountRequest struct {
	AccountID string `json:"account_id" binding:"required"`
} //@name TBankSetDefaultAccountRequest

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
