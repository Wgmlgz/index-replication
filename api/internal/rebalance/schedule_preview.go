package rebalance

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/moex"
	moexdomain "server/internal/moex/domain"

	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
)

const (
	defaultSchedulePreviewLimit    = 100
	maximumSchedulePreviewLimit    = 200
	maximumScheduleSearchAttempts  = 10000
	defaultScheduleCalendarDays    = 31
)

type SchedulePreviewService struct {
	profilesRepo profileRepository
	moexService  *moex.MoexService
	now          func() time.Time
}

func NewSchedulePreviewService(
	profilesRepo profileRepository,
	moexService *moex.MoexService,
) *SchedulePreviewService {
	return &SchedulePreviewService{
		profilesRepo: profilesRepo,
		moexService:  moexService,
		now: func() time.Time {
			return time.Now().UTC()
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
	if s.profilesRepo == nil || s.moexService == nil {
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

	schedule, err := s.moexService.GetEngineSchedule(ctx, "stock", "en", &from, to)
	if err != nil {
		return nil, err
	}
	calendarTo := resolveCalendarWindowEnd(from, to)
	calendar := newMoexTradingCalendar(schedule, from, calendarTo)

	events := make([]time.Time, 0, limit)
	cursor := from
	attempts := 0

	for len(events) < limit && attempts < maximumScheduleSearchAttempts {
		next := rule.After(cursor, true)
		if next.IsZero() {
			break
		}
		nextUTC := next.UTC()
		if nextUTC.After(calendarTo) {
			break
		}
		decision := calendar.Evaluate(nextUTC)
		if decision.Included {
			events = append(events, nextUTC)
		}
		cursor = nextUTC.Add(time.Nanosecond)
		attempts++
	}

	return &dto.PortfolioRebalanceSchedulePreviewResponse{
		Events: events,
		Moex: dto.PortfolioRebalanceSchedulePreviewMoexMetadata{
			Engine:   schedule.Engine,
			Calendar: calendar.Rows(),
		},
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
	options.Dtstart = req.DtStart.UTC()

	var to *time.Time
	if req.To != nil {
		toValue := req.To.UTC()
		to = &toValue
		options.Until = toValue
	}

	from := s.now().UTC()
	if req.From != nil {
		from = req.From.UTC()
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

type moexTradingWindow struct {
	Source    string
	IsWorkDay bool
	StartSec  int
	StopSec   int
	HasTime   bool
	StartTime *string
	StopTime  *string
}

type moexTradingCalendar struct {
	byDate map[string]moexTradingWindow
	rows   []dto.PortfolioRebalanceSchedulePreviewMoexCalendar
}

func newMoexTradingCalendar(
	schedule moexdomain.EngineSchedule,
	from time.Time,
	to time.Time,
) moexTradingCalendar {
	fromDate := normalizeDateUTC(from)
	toDate := normalizeDateUTC(to)
	if toDate.Before(fromDate) {
		fromDate, toDate = toDate, fromDate
	}

	daily := make(map[string]moexTradingWindow, len(schedule.Daily))
	weekly := make(map[int]moexTradingWindow, len(schedule.Timetable))

	for _, row := range schedule.Daily {
		key := strings.TrimSpace(row.Date)
		if key == "" {
			continue
		}
		window := toTradingWindow(row.IsWorkDay, row.StartTime, row.StopTime)
		window.Source = "dailytable"
		daily[key] = window
	}

	for _, row := range schedule.Timetable {
		if row.WeekDay <= 0 {
			continue
		}
		window := toTradingWindow(row.IsWorkDay, row.StartTime, row.StopTime)
		window.Source = "timetable"
		weekly[row.WeekDay] = window
	}

	dayCount := int(toDate.Sub(fromDate).Hours()/24) + 1
	if dayCount < 0 {
		dayCount = 0
	}
	result := moexTradingCalendar{
		byDate: make(map[string]moexTradingWindow, dayCount),
		rows:   make([]dto.PortfolioRebalanceSchedulePreviewMoexCalendar, 0, dayCount),
	}
	for day := fromDate; !day.After(toDate); day = day.AddDate(0, 0, 1) {
		key := day.Format("2006-01-02")
		window, ok := daily[key]
		if !ok {
			window, ok = weekly[isoWeekday(day.Weekday())]
		}
		if ok {
			result.byDate[key] = window
		}
		result.rows = append(result.rows, buildMoexCalendarRow(key, ok, window))
	}

	return result
}

func (c moexTradingCalendar) Rows() []dto.PortfolioRebalanceSchedulePreviewMoexCalendar {
	return c.rows
}

func toTradingWindow(isWorkDay bool, startRaw, stopRaw *string) moexTradingWindow {
	startSec, okStart := parseTimeOfDaySeconds(startRaw)
	stopSec, okStop := parseTimeOfDaySeconds(stopRaw)
	return moexTradingWindow{
		Source:    "none",
		IsWorkDay: isWorkDay,
		StartSec:  startSec,
		StopSec:   stopSec,
		HasTime:   okStart && okStop,
		StartTime: normalizeTimeStringPtr(startRaw),
		StopTime:  normalizeTimeStringPtr(stopRaw),
	}
}

type moexTradingDecision struct {
	Included bool
}

func (c moexTradingCalendar) Evaluate(at time.Time) moexTradingDecision {
	atUTC := at.UTC()
	dateKey := atUTC.Format("2006-01-02")

	window, ok := c.byDate[dateKey]
	if !ok {
		return moexTradingDecision{
			Included: false,
		}
	}
	if !window.IsWorkDay {
		return moexTradingDecision{
			Included: false,
		}
	}
	if !window.HasTime {
		return moexTradingDecision{
			Included: false,
		}
	}

	seconds := atUTC.Hour()*3600 + atUTC.Minute()*60 + atUTC.Second()
	if seconds < window.StartSec || seconds > window.StopSec {
		return moexTradingDecision{
			Included: false,
		}
	}
	return moexTradingDecision{
		Included: true,
	}
}

func parseTimeOfDaySeconds(value *string) (int, bool) {
	if value == nil {
		return 0, false
	}
	raw := strings.TrimSpace(*value)
	if raw == "" {
		return 0, false
	}
	layouts := []string{"15:04:05", "15:04"}
	for _, layout := range layouts {
		parsed, err := time.Parse(layout, raw)
		if err != nil {
			continue
		}
		return parsed.Hour()*3600 + parsed.Minute()*60 + parsed.Second(), true
	}
	return 0, false
}

func isoWeekday(weekday time.Weekday) int {
	if weekday == time.Sunday {
		return 7
	}
	return int(weekday)
}

func normalizeTimeStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func buildMoexCalendarRow(
	date string,
	hasWindow bool,
	window moexTradingWindow,
) dto.PortfolioRebalanceSchedulePreviewMoexCalendar {
	if !hasWindow {
		return dto.PortfolioRebalanceSchedulePreviewMoexCalendar{
			Date:   date,
			Source: "none",
		}
	}
	isWorkDay := window.IsWorkDay
	return dto.PortfolioRebalanceSchedulePreviewMoexCalendar{
		Date:      date,
		Source:    window.Source,
		IsWorkDay: &isWorkDay,
		StartTime: window.StartTime,
		StopTime:  window.StopTime,
	}
}

func normalizeDateUTC(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func resolveCalendarWindowEnd(from time.Time, to *time.Time) time.Time {
	if to != nil {
		return to.UTC()
	}
	return from.UTC().AddDate(0, 0, defaultScheduleCalendarDays)
}
