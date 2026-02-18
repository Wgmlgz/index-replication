package services

import (
	"context"
	"fmt"
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

func (s *MoexReadService) GetIndexCompositionSeries(ctx context.Context, indexID string, tickers []string, from, till string, intervalDays int, _ string) (map[string][]models.MoexIndexTickerAnalyticsPoint, *MoexCoverageMeta, error) {
	fromDate, tillDate, err := parseRangePointers(from, till)
	if err != nil {
		return nil, nil, err
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

	for _, ticker := range tickers {
		points := grouped[ticker]
		series[ticker] = downsampleTickerSeries(points, fromStr, tillStr, intervalDays)
	}

	meta, err := s.buildCoverageMeta(ctx, "composition", indexID, targetFrom, targetTill, nil)
	if err != nil {
		return nil, nil, err
	}
	return series, meta, nil
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
