package dto

import "time"

type PortfolioRebalanceScheduleConfigUpsertRequest struct {
	IsEnabled             bool      `json:"is_enabled"`
	DtStart               time.Time `json:"dtstart" binding:"required"` // RFC3339 datetime
	RRule                 string    `json:"rrule" binding:"required"`   // RFC5545 RRULE (without DTSTART)
	BusinessDayAdjustment string    `json:"business_day_adjustment,omitempty"`
} //@name PortfolioRebalanceScheduleConfigUpsertRequest

type PortfolioRebalanceScheduleConfigResponse struct {
	IsEnabled             bool      `json:"is_enabled"`
	DtStart               time.Time `json:"dtstart"` // RFC3339 datetime
	RRule                 string    `json:"rrule"`   // RFC5545 RRULE (without DTSTART)
	BusinessDayAdjustment string    `json:"business_day_adjustment"`
	UpdatedAt             time.Time `json:"updated_at"`
} //@name PortfolioRebalanceScheduleConfigResponse
