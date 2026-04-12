package dto

import "time"

type PortfolioRebalanceSchedulePreviewRequest struct {
	DtStart time.Time  `json:"dtstart" binding:"required"` // RFC3339 datetime
	RRule   string     `json:"rrule" binding:"required"`   // RFC5545 RRULE (without DTSTART)
	From    *time.Time `json:"from,omitempty"`             // optional lower bound (default now)
	To      *time.Time `json:"to,omitempty"`               // optional upper bound
	Limit   *int       `json:"limit,omitempty"`            // optional max event count
} //@name PortfolioRebalanceSchedulePreviewRequest

type PortfolioRebalanceSchedulePreviewResponse struct {
	Events []time.Time                                   `json:"events"` // RFC3339 datetimes
	Moex   PortfolioRebalanceSchedulePreviewMoexMetadata `json:"moex"`
} //@name PortfolioRebalanceSchedulePreviewResponse

type PortfolioRebalanceSchedulePreviewMoexMetadata struct {
	Engine   string                                          `json:"engine"`
	Calendar []PortfolioRebalanceSchedulePreviewMoexCalendar `json:"calendar"`
} //@name PortfolioRebalanceSchedulePreviewMoexMetadata

type PortfolioRebalanceSchedulePreviewMoexCalendar struct {
	Date      string  `json:"date"`                   // YYYY-MM-DD
	Source    string  `json:"source"`                 // dailytable|timetable|none
	IsWorkDay *bool   `json:"is_work_day,omitempty"`  // nil for source=none
	StartTime *string `json:"start_time,omitempty"`   // MOEX window start (HH:mm[:ss])
	StopTime  *string `json:"stop_time,omitempty"`    // MOEX window stop (HH:mm[:ss])
} //@name PortfolioRebalanceSchedulePreviewMoexCalendar
