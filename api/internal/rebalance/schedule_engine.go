package rebalance

import (
	"context"
	"fmt"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/isdayoff"

	"github.com/teambition/rrule-go"
)

const (
	defaultSchedulePreviewLimit   = 100
	maximumSchedulePreviewLimit   = 200
	maximumScheduleSearchAttempts = 10000
	defaultScheduleCalendarDays   = 31
	scheduleCalendarPaddingDays   = 31
	maximumAdjustmentSearchDays   = 370
	defaultScheduleTimezone       = "Europe/Moscow"
	sessionStartTime              = "10:00"
	sessionStopTime               = "18:40"
	sessionStartSec               = 10 * 3600
	sessionStopSec                = 18*3600 + 40*60
)

type scheduleEventEngine struct {
	dayOffService *isdayoff.Service
	location      *time.Location
}

type scheduleEventPlan struct {
	rule   *rrule.RRule
	from   time.Time
	to     *time.Time
	limit  int
	policy businessDayAdjustmentPolicy
}

type scheduleEventResult struct {
	Events   []time.Time
	Calendar []dto.PortfolioRebalanceSchedulePreviewCalendar
}

func newScheduleEventEngine(dayOffService *isdayoff.Service, location *time.Location) *scheduleEventEngine {
	return &scheduleEventEngine{
		dayOffService: dayOffService,
		location:      location,
	}
}

func (e *scheduleEventEngine) Calculate(
	ctx context.Context,
	plan scheduleEventPlan,
) (*scheduleEventResult, error) {
	displayFrom := plan.from
	displayTo := resolveCalendarWindowEnd(plan.from, plan.to)
	calendarFetchFrom, calendarFetchTo := resolveCalendarFetchWindow(displayFrom, displayTo)
	calendar, err := newTradingCalendar(ctx, e.dayOffService, calendarFetchFrom, calendarFetchTo, e.location)
	if err != nil {
		return nil, err
	}

	events := make([]time.Time, 0, plan.limit)
	seen := make(map[string]struct{}, plan.limit)
	cursor := plan.from
	attempts := 0

	for len(events) < plan.limit && attempts < maximumScheduleSearchAttempts {
		next := plan.rule.After(cursor, true)
		if next.IsZero() {
			break
		}
		if next.After(displayTo) {
			break
		}

		shouldAdjustByPolicy := plan.policy != businessDayAdjustmentStrict
		candidate, included := next, false
		if shouldAdjustByPolicy {
			candidate, included = calendar.AdjustByPolicy(next, plan.policy)
		} else {
			included = calendar.Evaluate(next).Included
		}
		if included && !candidate.Before(displayFrom) && !candidate.After(displayTo) {
			key := candidate.UTC().Format(time.RFC3339Nano)
			if _, exists := seen[key]; !exists {
				events = append(events, candidate.UTC())
				seen[key] = struct{}{}
			}
		}
		cursor = next.Add(time.Nanosecond)
		attempts++
	}

	return &scheduleEventResult{
		Events:   events,
		Calendar: calendar.RowsInRange(displayFrom, displayTo),
	}, nil
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

func (c tradingCalendar) RowsInRange(from time.Time, to time.Time) []dto.PortfolioRebalanceSchedulePreviewCalendar {
	fromDate := normalizeDateInLocation(from, c.loc)
	toDate := normalizeDateInLocation(to, c.loc)
	if toDate.Before(fromDate) {
		fromDate, toDate = toDate, fromDate
	}
	fromKey := fromDate.Format("2006-01-02")
	toKey := toDate.Format("2006-01-02")

	result := make([]dto.PortfolioRebalanceSchedulePreviewCalendar, 0, len(c.rows))
	for _, row := range c.rows {
		if row.Date < fromKey || row.Date > toKey {
			continue
		}
		result = append(result, row)
	}
	return result
}

func (c tradingCalendar) AdjustByPolicy(at time.Time, policy businessDayAdjustmentPolicy) (time.Time, bool) {
	if c.Evaluate(at).Included {
		return at, true
	}

	atLocal := at.In(c.loc)
	switch policy {
	case businessDayAdjustmentFollowing:
		return c.findNearestTradingDay(atLocal, 1, false)
	case businessDayAdjustmentPreceding:
		return c.findNearestTradingDay(atLocal, -1, false)
	case businessDayAdjustmentModifiedFollowing:
		if adjusted, ok := c.findNearestTradingDay(atLocal, 1, true); ok {
			return adjusted, true
		}
		return c.findNearestTradingDay(atLocal, -1, true)
	case businessDayAdjustmentModifiedPreceding:
		if adjusted, ok := c.findNearestTradingDay(atLocal, -1, true); ok {
			return adjusted, true
		}
		return c.findNearestTradingDay(atLocal, 1, true)
	default:
		return at, false
	}
}

func (c tradingCalendar) findNearestTradingDay(
	start time.Time,
	directionDays int,
	sameMonthOnly bool,
) (time.Time, bool) {
	if directionDays == 0 {
		return time.Time{}, false
	}

	month := start.Month()
	year := start.Year()
	steps := 0
	for candidate := start; steps < maximumAdjustmentSearchDays; candidate = candidate.AddDate(0, 0, directionDays) {
		if steps > 0 {
			if sameMonthOnly && (candidate.Month() != month || candidate.Year() != year) {
				return time.Time{}, false
			}
			if c.Evaluate(candidate).Included {
				return candidate, true
			}
		}
		steps++
	}
	return time.Time{}, false
}

func normalizeDateInLocation(value time.Time, location *time.Location) time.Time {
	local := value.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
}

func resolveCalendarFetchWindow(from time.Time, to time.Time) (time.Time, time.Time) {
	return from.AddDate(0, 0, -scheduleCalendarPaddingDays), to.AddDate(0, 0, scheduleCalendarPaddingDays)
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

func prepareSchedulePreviewPlan(
	req *dto.PortfolioRebalanceSchedulePreviewRequest,
	now func() time.Time,
	location *time.Location,
) (*scheduleEventPlan, error) {
	if req.DtStart.IsZero() {
		return nil, fmt.Errorf("%w: dtstart is required", ErrInvalidRequest)
	}

	ruleText := strings.TrimSpace(req.RRule)
	if ruleText == "" {
		return nil, fmt.Errorf("%w: rrule is required", ErrInvalidRequest)
	}
	if strings.HasPrefix(strings.ToUpper(ruleText), "RRULE:") {
		ruleText = strings.TrimSpace(ruleText[len("RRULE:"):])
	}

	options, err := rrule.StrToROption(ruleText)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid rrule: %v", ErrInvalidRequest, err)
	}
	policy, err := parseBusinessDayAdjustmentPolicy(req.BusinessDayAdjustment)
	if err != nil {
		return nil, err
	}
	options.Dtstart = req.DtStart.In(location)

	var to *time.Time
	if req.To != nil {
		toValue := req.To.In(location)
		to = &toValue
		options.Until = toValue
	}

	from := now().In(location)
	if req.From != nil {
		from = req.From.In(location)
	}
	if to != nil && from.After(*to) {
		return nil, fmt.Errorf("%w: from must be <= to", ErrInvalidRequest)
	}

	limit := defaultSchedulePreviewLimit
	if req.Limit != nil {
		if *req.Limit <= 0 {
			return nil, fmt.Errorf("%w: limit must be > 0", ErrInvalidRequest)
		}
		if *req.Limit > maximumSchedulePreviewLimit {
			return nil, fmt.Errorf("%w: limit must be <= %d", ErrInvalidRequest, maximumSchedulePreviewLimit)
		}
		limit = *req.Limit
	}

	rule, err := rrule.NewRRule(*options)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid rrule options: %v", ErrInvalidRequest, err)
	}

	return &scheduleEventPlan{
		rule:   rule,
		from:   from,
		to:     to,
		limit:  limit,
		policy: policy,
	}, nil
}
