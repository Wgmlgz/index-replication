package dto

import "time"

type PortfolioRebalanceSchedulePreviewRequest struct {
	DtStart               time.Time  `json:"dtstart" binding:"required"` // RFC3339 datetime
	RRule                 string     `json:"rrule" binding:"required"`   // RFC5545 RRULE (without DTSTART)
	BusinessDayAdjustment string     `json:"business_day_adjustment,omitempty"`
	From                  *time.Time `json:"from,omitempty"`  // optional lower bound (default now)
	To                    *time.Time `json:"to,omitempty"`    // optional upper bound
	Limit                 *int       `json:"limit,omitempty"` // optional max event count
} //@name PortfolioRebalanceSchedulePreviewRequest

type PortfolioRebalanceSchedulePreviewResponse struct {
	Events   []time.Time                                 `json:"events"` // RFC3339 datetimes
	Calendar []PortfolioRebalanceSchedulePreviewCalendar `json:"calendar"`
} //@name PortfolioRebalanceSchedulePreviewResponse

type PortfolioRebalanceSchedulePreviewCalendar struct {
	Date      string  `json:"date"`                  // YYYY-MM-DD
	Source    string  `json:"source"`                // isdayoff
	DayCode   string  `json:"day_code"`              // isdayoff code: 0|1|2|4|8
	DayType   string  `json:"day_type"`              // workday|non_working_day|shortened_workday|special_workday|public_holiday
	IsWorkDay *bool   `json:"is_work_day,omitempty"` // nil when date has no resolved status
	StartTime *string `json:"start_time,omitempty"`  // trading window start (HH:mm)
	StopTime  *string `json:"stop_time,omitempty"`   // trading window stop (HH:mm)
} //@name PortfolioRebalanceSchedulePreviewCalendar
