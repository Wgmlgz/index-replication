package services

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"server/internal/models"
	"server/internal/repository"
)

type MoexCoverageMeta struct {
	Dataset       string                         `json:"dataset"`
	EntityKey     string                         `json:"entityKey"`
	Status        string                         `json:"status"`
	RequestedFrom string                         `json:"requestedFrom,omitempty"`
	RequestedTill string                         `json:"requestedTill,omitempty"`
	MissingRanges []repository.MoexCoverageRange `json:"missingRanges,omitempty"`
}

type MoexReadService struct {
	repo                  *repository.MoexDataRepository
	liveService           *MoexService
	liveCurrentDayEnabled bool
}

func NewMoexReadService(repo *repository.MoexDataRepository, liveService *MoexService, liveCurrentDayEnabled bool) *MoexReadService {
	return &MoexReadService{
		repo:                  repo,
		liveService:           liveService,
		liveCurrentDayEnabled: liveCurrentDayEnabled,
	}
}

func (s *MoexReadService) GetIndexesOverview(ctx context.Context, _ string) (models.MoexIndexesOverviewResponse, error) {
	return s.repo.GetOverview(ctx)
}

func (s *MoexReadService) GetIndexHistory(ctx context.Context, secid, from, till string, intervalDays int) ([]models.MoexIndexHistoryPoint, *MoexCoverageMeta, error) {
	fromDate, tillDate, err := parseRangePointers(from, till)
	if err != nil {
		return nil, nil, err
	}

	points, err := s.repo.ListHistoryPoints(ctx, secid, fromDate, tillDate)
	if err != nil {
		return nil, nil, err
	}

	if s.liveCurrentDayEnabled && rangeTouchesToday(fromDate, tillDate) {
		if livePoints, liveErr := s.liveService.GetIndexHistory(ctx, secid, todayUTC().Format("2006-01-02"), todayUTC().Format("2006-01-02"), 1); liveErr == nil {
			points = mergeHistoryPoints(points, livePoints)
		}
	}

	interval := resolveIntervalDaysFromHistory(points, intervalDays)
	result := downsampleHistory(points, interval)

	meta, err := s.buildCoverageMeta(ctx, "history", secid, fromDate, tillDate, result)
	if err != nil {
		return nil, nil, err
	}
	return result, meta, nil
}

func (s *MoexReadService) GetIndexComposition(ctx context.Context, indexID, date, lang string) ([]models.MoexIndexCompositionEntry, *MoexCoverageMeta, error) {
	_ = lang

	preferredDate := todayUTC()
	if strings.TrimSpace(date) != "" {
		parsed, err := time.Parse("2006-01-02", strings.TrimSpace(date))
		if err != nil {
			return nil, nil, fmt.Errorf("invalid date: %w", err)
		}
		preferredDate = dateOnlyUTC(parsed)
	}

	snapshotDate, err := s.repo.ResolveCompositionDate(ctx, indexID, &preferredDate)
	if err != nil {
		return nil, nil, err
	}

	if snapshotDate == nil {
		if s.liveCurrentDayEnabled && preferredDate.Equal(todayUTC()) {
			rows, liveErr := s.liveService.GetIndexComposition(ctx, indexID, preferredDate.Format("2006-01-02"), "en")
			if liveErr == nil {
				meta, err := s.buildCoverageMeta(ctx, "composition", indexID, &preferredDate, &preferredDate, nil)
				if err != nil {
					return nil, nil, err
				}
				return rows, meta, nil
			}
		}
		meta, err := s.buildCoverageMeta(ctx, "composition", indexID, &preferredDate, &preferredDate, nil)
		if err != nil {
			return nil, nil, err
		}
		return []models.MoexIndexCompositionEntry{}, meta, nil
	}

	rows, err := s.repo.ListCompositionByDate(ctx, indexID, *snapshotDate)
	if err != nil {
		return nil, nil, err
	}

	meta, err := s.buildCoverageMeta(ctx, "composition", indexID, snapshotDate, snapshotDate, nil)
	if err != nil {
		return nil, nil, err
	}
	return rows, meta, nil
}

func (s *MoexReadService) GetIndexCompositionSeries(ctx context.Context, indexID string, tickers []string, topCount int, from, till string, intervalDays int, _ string) (map[string][]models.MoexIndexTickerAnalyticsPoint, *MoexCoverageMeta, error) {
	fromDate, tillDate, err := parseRangePointers(from, till)
	if err != nil {
		return nil, nil, err
	}

	tickers, err = s.resolveSeriesTickers(ctx, indexID, tickers, topCount, tillDate)
	if err != nil {
		return nil, nil, err
	}
	if len(tickers) == 0 {
		meta, err := s.buildCoverageMeta(ctx, "composition", indexID, fromDate, tillDate, nil)
		if err != nil {
			return nil, nil, err
		}
		return map[string][]models.MoexIndexTickerAnalyticsPoint{}, meta, nil
	}

	rows, err := s.repo.ListCompositionSeriesRows(ctx, indexID, tickers, fromDate, tillDate)
	if err != nil {
		return nil, nil, err
	}

	series := make(map[string][]models.MoexIndexTickerAnalyticsPoint, len(tickers))
	for _, ticker := range tickers {
		series[ticker] = []models.MoexIndexTickerAnalyticsPoint{}
	}

	grouped := make(map[string][]models.MoexIndexTickerAnalyticsPoint, len(tickers))
	var inferredFrom *time.Time
	var inferredTill *time.Time
	for _, row := range rows {
		tradeDate := dateOnlyUTC(row.TradeDate)
		dateStr := tradeDate.Format("2006-01-02")
		grouped[row.Ticker] = append(grouped[row.Ticker], models.MoexIndexTickerAnalyticsPoint{
			TradeDate: dateStr,
			Weight:    row.Weight,
		})
		if inferredFrom == nil || tradeDate.Before(*inferredFrom) {
			value := tradeDate
			inferredFrom = &value
		}
		if inferredTill == nil || tradeDate.After(*inferredTill) {
			value := tradeDate
			inferredTill = &value
		}
	}

	targetFrom := fromDate
	targetTill := tillDate
	if targetFrom == nil {
		targetFrom = inferredFrom
	}
	if targetTill == nil {
		targetTill = inferredTill
	}

	fromStr := ""
	tillStr := ""
	if targetFrom != nil {
		fromStr = targetFrom.Format("2006-01-02")
	}
	if targetTill != nil {
		tillStr = targetTill.Format("2006-01-02")
	}

	anchors := downsampleDateLabels(extractSortedTradeDates(rows, fromStr, tillStr), intervalDays)
	for _, ticker := range tickers {
		series[ticker] = alignTickerSeriesByDates(grouped[ticker], anchors)
	}

	meta, err := s.buildCoverageMeta(ctx, "composition", indexID, targetFrom, targetTill, nil)
	if err != nil {
		return nil, nil, err
	}
	return series, meta, nil
}

func extractSortedTradeDates(rows []repository.MoexCompositionSeriesRow, from, till string) []string {
	unique := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		date := dateOnlyUTC(row.TradeDate).Format("2006-01-02")
		if from != "" && date < from {
			continue
		}
		if till != "" && date > till {
			continue
		}
		unique[date] = struct{}{}
	}
	if len(unique) == 0 {
		return []string{}
	}
	dates := make([]string, 0, len(unique))
	for date := range unique {
		dates = append(dates, date)
	}
	sort.Strings(dates)
	return dates
}

func downsampleDateLabels(dates []string, intervalDays int) []string {
	if len(dates) <= 1 || intervalDays <= 1 {
		return dates
	}
	result := make([]string, 0, len(dates))
	var last time.Time
	hasLast := false
	for _, date := range dates {
		parsed, err := time.Parse("2006-01-02", date)
		if err != nil {
			continue
		}
		parsed = dateOnlyUTC(parsed)
		if !hasLast {
			result = append(result, date)
			last = parsed
			hasLast = true
			continue
		}
		diff := int(math.Abs(parsed.Sub(last).Hours() / 24))
		if diff < intervalDays {
			continue
		}
		result = append(result, date)
		last = parsed
	}
	lastDate := dates[len(dates)-1]
	if len(result) == 0 || result[len(result)-1] != lastDate {
		result = append(result, lastDate)
	}
	return result
}

func alignTickerSeriesByDates(points []models.MoexIndexTickerAnalyticsPoint, dates []string) []models.MoexIndexTickerAnalyticsPoint {
	if len(dates) == 0 {
		return []models.MoexIndexTickerAnalyticsPoint{}
	}
	weightsByDate := make(map[string]*float64, len(points))
	for _, point := range points {
		date := strings.TrimSpace(point.TradeDate)
		if date == "" {
			continue
		}
		weightsByDate[date] = point.Weight
	}
	result := make([]models.MoexIndexTickerAnalyticsPoint, 0, len(dates))
	for _, date := range dates {
		weight, ok := weightsByDate[date]
		if !ok || weight == nil {
			zero := 0.0
			result = append(result, models.MoexIndexTickerAnalyticsPoint{
				TradeDate: date,
				Weight:    &zero,
			})
			continue
		}
		value := *weight
		result = append(result, models.MoexIndexTickerAnalyticsPoint{
			TradeDate: date,
			Weight:    &value,
		})
	}
	return result
}

func (s *MoexReadService) resolveSeriesTickers(ctx context.Context, indexID string, tickers []string, topCount int, tillDate *time.Time) ([]string, error) {
	normalized := normalizeTickers(tickers)
	if len(normalized) > 0 {
		return normalized, nil
	}

	if topCount < 0 {
		topCount = 0
	}

	preferredDate := todayUTC()
	if tillDate != nil {
		preferredDate = dateOnlyUTC(*tillDate)
	}

	snapshotDate, err := s.repo.ResolveCompositionDate(ctx, indexID, &preferredDate)
	if err != nil {
		return nil, err
	}
	if snapshotDate == nil {
		return []string{}, nil
	}

	rows, err := s.repo.ListCompositionByDate(ctx, indexID, *snapshotDate)
	if err != nil {
		return nil, err
	}

	sort.Slice(rows, func(i, j int) bool {
		leftWeight := -math.MaxFloat64
		rightWeight := -math.MaxFloat64
		if rows[i].Weight != nil {
			leftWeight = *rows[i].Weight
		}
		if rows[j].Weight != nil {
			rightWeight = *rows[j].Weight
		}
		if leftWeight == rightWeight {
			return rows[i].Ticker < rows[j].Ticker
		}
		return leftWeight > rightWeight
	})

	if topCount > 0 && len(rows) > topCount {
		rows = rows[:topCount]
	}

	autoTickers := make([]string, 0, len(rows))
	seen := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		ticker := strings.TrimSpace(row.Ticker)
		if ticker == "" {
			continue
		}
		if _, exists := seen[ticker]; exists {
			continue
		}
		seen[ticker] = struct{}{}
		autoTickers = append(autoTickers, ticker)
	}
	return autoTickers, nil
}

func normalizeTickers(tickers []string) []string {
	normalized := make([]string, 0, len(tickers))
	seen := make(map[string]struct{}, len(tickers))
	for _, ticker := range tickers {
		value := strings.TrimSpace(ticker)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func (s *MoexReadService) buildCoverageMeta(ctx context.Context, dataset, entityKey string, fromDate, tillDate *time.Time, points []models.MoexIndexHistoryPoint) (*MoexCoverageMeta, error) {
	effectiveFrom := fromDate
	effectiveTill := tillDate
	if (effectiveFrom == nil || effectiveTill == nil) && len(points) > 0 {
		firstDate, firstOK := parseDate(points[0].TradeDate)
		lastDate, lastOK := parseDate(points[len(points)-1].TradeDate)
		if firstOK && lastOK {
			firstDate = dateOnlyUTC(firstDate)
			lastDate = dateOnlyUTC(lastDate)
			if effectiveFrom == nil {
				effectiveFrom = &firstDate
			}
			if effectiveTill == nil {
				effectiveTill = &lastDate
			}
		}
	}

	meta := &MoexCoverageMeta{
		Dataset:   dataset,
		EntityKey: strings.TrimSpace(entityKey),
		Status:    "unknown",
	}

	if effectiveFrom == nil || effectiveTill == nil {
		return meta, nil
	}
	status, missing, err := s.repo.EvaluateCoverage(ctx, dataset, entityKey, *effectiveFrom, *effectiveTill)
	if err != nil {
		return nil, err
	}

	meta.Status = status
	meta.RequestedFrom = effectiveFrom.Format("2006-01-02")
	meta.RequestedTill = effectiveTill.Format("2006-01-02")
	meta.MissingRanges = missing
	return meta, nil
}

func parseRangePointers(from, till string) (*time.Time, *time.Time, error) {
	var fromDate *time.Time
	var tillDate *time.Time

	from = strings.TrimSpace(from)
	if from != "" {
		parsed, err := time.Parse("2006-01-02", from)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid from date: %w", err)
		}
		value := dateOnlyUTC(parsed)
		fromDate = &value
	}

	till = strings.TrimSpace(till)
	if till != "" {
		parsed, err := time.Parse("2006-01-02", till)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid till date: %w", err)
		}
		value := dateOnlyUTC(parsed)
		tillDate = &value
	}

	if fromDate != nil && tillDate != nil && fromDate.After(*tillDate) {
		fromDate, tillDate = tillDate, fromDate
	}
	return fromDate, tillDate, nil
}

func mergeHistoryPoints(existing, extra []models.MoexIndexHistoryPoint) []models.MoexIndexHistoryPoint {
	byDate := make(map[string]models.MoexIndexHistoryPoint, len(existing)+len(extra))
	for _, point := range existing {
		if strings.TrimSpace(point.TradeDate) == "" {
			continue
		}
		byDate[point.TradeDate] = point
	}
	for _, point := range extra {
		if strings.TrimSpace(point.TradeDate) == "" {
			continue
		}
		byDate[point.TradeDate] = point
	}

	merged := make([]models.MoexIndexHistoryPoint, 0, len(byDate))
	for _, point := range byDate {
		merged = append(merged, point)
	}
	sort.Slice(merged, func(i, j int) bool {
		return merged[i].TradeDate < merged[j].TradeDate
	})
	return merged
}

func rangeTouchesToday(fromDate, tillDate *time.Time) bool {
	today := todayUTC()
	if fromDate != nil && today.Before(*fromDate) {
		return false
	}
	if tillDate != nil && today.After(*tillDate) {
		return false
	}
	return true
}

func dateOnlyUTC(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func todayUTC() time.Time {
	return dateOnlyUTC(time.Now())
}
