package dto

import "time"

type PortfolioRebalanceScheduleConfigUpsertRequest struct {
	IsEnabled             bool      `json:"is_enabled"`
	DtStart               time.Time `json:"dtstart" binding:"required"` // RFC3339 datetime
	RRule                 string    `json:"rrule" binding:"required"`   // RFC5545 RRULE (without DTSTART)
	BusinessDayAdjustment string    `json:"business_day_adjustment,omitempty"`
} //@name PortfolioRebalanceScheduleConfigUpsertRequest

type PortfolioRebalanceScheduleConfigResponse struct {
	IsEnabled             bool       `json:"is_enabled"`
	DtStart               time.Time  `json:"dtstart"` // RFC3339 datetime
	RRule                 string     `json:"rrule"`   // RFC5545 RRULE (without DTSTART)
	BusinessDayAdjustment string     `json:"business_day_adjustment"`
	NextRunAt             *time.Time `json:"next_run_at"`
	LastRunAt             *time.Time `json:"last_run_at"`
	LastError             *string    `json:"last_error"`
	LastRunID             *int       `json:"last_run_id"`
	UpdatedAt             time.Time  `json:"updated_at"`
} //@name PortfolioRebalanceScheduleConfigResponse
