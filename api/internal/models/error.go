package models

// ErrorResponse represents a generic error response with message
// swagger:model
type ErrorResponse struct {
	Error string `json:"error"`
}
