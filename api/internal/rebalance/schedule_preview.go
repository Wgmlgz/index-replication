package rebalance

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/isdayoff"

	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
)

const (
	defaultSchedulePreviewLimit   = 100
	maximumSchedulePreviewLimit   = 200
	maximumScheduleSearchAttempts = 10000
	defaultScheduleCalendarDays   = 31
	defaultScheduleTimezone       = "Europe/Moscow"
	sessionStartTime              = "10:00"
	sessionStopTime               = "18:40"
	sessionStartSec               = 10 * 3600
	sessionStopSec                = 18*3600 + 40*60
)

type SchedulePreviewService struct {
	profilesRepo  profileRepository
	dayOffService *isdayoff.Service
	location      *time.Location
	now           func() time.Time
}

func NewSchedulePreviewService(
	profilesRepo profileRepository,
	dayOffService *isdayoff.Service,
	scheduleTimezone ...string,
) *SchedulePreviewService {
	location := loadScheduleLocation(scheduleTimezone...)
	return &SchedulePreviewService{
		profilesRepo:  profilesRepo,
		dayOffService: dayOffService,
		location:      location,
		now: func() time.Time {
			return time.Now().In(location)
		},
	}
}

func (s *SchedulePreviewService) Preview(
	ctx context.Context,
	userID int,
	portfolioID int,
	req *dto.PortfolioRebalanceSchedulePreviewRequest,
) (*dto.PortfolioRebalanceSchedulePreviewResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("%w: empty payload", ErrInvalidRequest)
	}
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if s.profilesRepo == nil || s.dayOffService == nil {
		return nil, ErrSchedulePreviewUnavailable
	}

	if _, err := s.profilesRepo.GetByID(userID, portfolioID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProfileNotFound
		}
		return nil, err
	}

	rule, from, to, limit, err := s.prepareRule(req)
	if err != nil {
		return nil, err
	}

	calendarTo := resolveCalendarWindowEnd(from, to)
	calendar, err := newTradingCalendar(ctx, s.dayOffService, from, calendarTo, s.location)
	if err != nil {
		return nil, err
	}

	events := make([]time.Time, 0, limit)
	cursor := from
	attempts := 0

	for len(events) < limit && attempts < maximumScheduleSearchAttempts {
		next := rule.After(cursor, true)
		if next.IsZero() {
			break
		}
		if next.After(calendarTo) {
			break
		}
		decision := calendar.Evaluate(next)
		if decision.Included {
			events = append(events, next.UTC())
		}
		cursor = next.Add(time.Nanosecond)
		attempts++
	}

	return &dto.PortfolioRebalanceSchedulePreviewResponse{
		Events:   events,
		Calendar: calendar.Rows(),
	}, nil
}

func (s *SchedulePreviewService) prepareRule(
	req *dto.PortfolioRebalanceSchedulePreviewRequest,
) (*rrule.RRule, time.Time, *time.Time, int, error) {
	if req.DtStart.IsZero() {
		return nil, time.Time{}, nil, 0, fmt.Errorf("%w: dtstart is required", ErrInvalidRequest)
	}

	ruleText := strings.TrimSpace(req.RRule)
	if ruleText == "" {
		return nil, time.Time{}, nil, 0, fmt.Errorf("%w: rrule is required", ErrInvalidRequest)
	}
	ruleText = strings.TrimSpace(ruleText)
	if strings.HasPrefix(strings.ToUpper(ruleText), "RRULE:") {
		ruleText = strings.TrimSpace(ruleText[len("RRULE:"):])
	}

	options, err := rrule.StrToROption(ruleText)
	if err != nil {
		return nil, time.Time{}, nil, 0, fmt.Errorf("%w: invalid rrule: %v", ErrInvalidRequest, err)
	}
	options.Dtstart = req.DtStart.In(s.location)

	var to *time.Time
	if req.To != nil {
		toValue := req.To.In(s.location)
		to = &toValue
		options.Until = toValue
	}

	from := s.now().In(s.location)
	if req.From != nil {
		from = req.From.In(s.location)
	}
	if to != nil && from.After(*to) {
		return nil, time.Time{}, nil, 0, fmt.Errorf("%w: from must be <= to", ErrInvalidRequest)
	}

	limit := defaultSchedulePreviewLimit
	if req.Limit != nil {
		if *req.Limit <= 0 {
			return nil, time.Time{}, nil, 0, fmt.Errorf("%w: limit must be > 0", ErrInvalidRequest)
		}
		if *req.Limit > maximumSchedulePreviewLimit {
			return nil, time.Time{}, nil, 0, fmt.Errorf("%w: limit must be <= %d", ErrInvalidRequest, maximumSchedulePreviewLimit)
		}
		limit = *req.Limit
	}

	rule, err := rrule.NewRRule(*options)
	if err != nil {
		return nil, time.Time{}, nil, 0, fmt.Errorf("%w: invalid rrule options: %v", ErrInvalidRequest, err)
	}

	return rule, from, to, limit, nil
}

type tradingWindow struct {
	IsWorkDay bool
}

type tradingCalendar struct {
	byDate map[string]tradingWindow
	rows   []dto.PortfolioRebalanceSchedulePreviewCalendar
	loc    *time.Location
}

func newTradingCalendar(
	ctx context.Context,
	dayOffService *isdayoff.Service,
	from time.Time,
	to time.Time,
	location *time.Location,
) (tradingCalendar, error) {
	fromDate := normalizeDateInLocation(from, location)
	toDate := normalizeDateInLocation(to, location)
	if toDate.Before(fromDate) {
		fromDate, toDate = toDate, fromDate
	}

	statuses, err := dayOffService.GetRange(ctx, fromDate, toDate)
	if err != nil {
		return tradingCalendar{}, err
	}

	dayCount := int(toDate.Sub(fromDate).Hours()/24) + 1
	if dayCount < 0 {
		dayCount = 0
	}
	result := tradingCalendar{
		byDate: make(map[string]tradingWindow, dayCount),
		rows:   make([]dto.PortfolioRebalanceSchedulePreviewCalendar, 0, dayCount),
		loc:    location,
	}
	for day := fromDate; !day.After(toDate); day = day.AddDate(0, 0, 1) {
		key := day.Format("2006-01-02")
		status, ok := statuses[key]
		if !ok {
			result.rows = append(result.rows, dto.PortfolioRebalanceSchedulePreviewCalendar{
				Date:   key,
				Source: "none",
			})
			continue
		}

		result.byDate[key] = tradingWindow{
			IsWorkDay: status.IsWorkDay,
		}

		isWorkDay := status.IsWorkDay
		row := dto.PortfolioRebalanceSchedulePreviewCalendar{
			Date:      key,
			Source:    "isdayoff",
			DayCode:   status.Code,
			DayType:   status.Type,
			IsWorkDay: &isWorkDay,
		}
		if status.IsWorkDay {
			start := sessionStartTime
			stop := sessionStopTime
			row.StartTime = &start
			row.StopTime = &stop
		}
		result.rows = append(result.rows, row)
	}

	return result, nil
}

func (c tradingCalendar) Rows() []dto.PortfolioRebalanceSchedulePreviewCalendar {
	return c.rows
}

type tradingDecision struct {
	Included bool
}

func (c tradingCalendar) Evaluate(at time.Time) tradingDecision {
	atLocal := at.In(c.loc)
	dateKey := atLocal.Format("2006-01-02")

	window, ok := c.byDate[dateKey]
	if !ok {
		return tradingDecision{
			Included: false,
		}
	}
	if !window.IsWorkDay {
		return tradingDecision{
			Included: false,
		}
	}

	seconds := atLocal.Hour()*3600 + atLocal.Minute()*60 + atLocal.Second()
	if seconds < sessionStartSec || seconds > sessionStopSec {
		return tradingDecision{
			Included: false,
		}
	}
	return tradingDecision{
		Included: true,
	}
}

func normalizeDateInLocation(value time.Time, location *time.Location) time.Time {
	local := value.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
}

func resolveCalendarWindowEnd(from time.Time, to *time.Time) time.Time {
	if to != nil {
		return *to
	}
	return from.AddDate(0, 0, defaultScheduleCalendarDays)
}

func loadScheduleLocation(scheduleTimezone ...string) *time.Location {
	timezone := defaultScheduleTimezone
	if len(scheduleTimezone) > 0 && strings.TrimSpace(scheduleTimezone[0]) != "" {
		timezone = strings.TrimSpace(scheduleTimezone[0])
	}
	location, err := time.LoadLocation(timezone)
	if err == nil {
		return location
	}
	fallback, fallbackErr := time.LoadLocation(defaultScheduleTimezone)
	if fallbackErr == nil {
		return fallback
	}
	return time.UTC
}
