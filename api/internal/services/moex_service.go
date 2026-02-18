package services

import (
	"context"
	"errors"
	"math"
	"net/http"
	"server/internal/models"
	"sort"
	"strings"
	"time"
)

const moexDefaultTargetPoints = 300

var moexIntervals = []int{1, 2, 3, 7, 14, 30}

type MoexService struct {
	client *moexISSClient
}

type MoexIndexTickerWindow struct {
	Ticker string
	From   string
	Till   string
}

func NewMoexService(baseURL string) *MoexService {
	return &MoexService{
		client: newMoexISSClient(baseURL, 20*time.Second),
	}
}

func (s *MoexService) GetIndexesOverview(ctx context.Context, lang string) (models.MoexIndexesOverviewResponse, error) {
	if strings.TrimSpace(lang) == "" {
		lang = "ru"
	}

	indexes, err := s.client.FetchIndexes(ctx, lang)
	if err != nil {
		return models.MoexIndexesOverviewResponse{}, err
	}

	collections, err := s.client.FetchCollections(ctx, lang)
	if err != nil {
		return models.MoexIndexesOverviewResponse{}, err
	}

	memberships, err := s.client.FetchCollectionMemberships(ctx, lang, collections)
	if err != nil {
		return models.MoexIndexesOverviewResponse{}, err
	}

	return models.MoexIndexesOverviewResponse{
		Indexes:     indexes,
		Collections: collections,
		Memberships: memberships,
	}, nil
}

func (s *MoexService) GetIndexHistory(ctx context.Context, secid, from, till string, intervalDays int) ([]models.MoexIndexHistoryPoint, error) {
	points, err := s.client.FetchHistory(ctx, secid, from, till)
	if err != nil {
		return nil, err
	}
	interval := resolveIntervalDaysFromHistory(points, intervalDays)
	return downsampleHistory(points, interval), nil
}

func (s *MoexService) GetIndexComposition(ctx context.Context, indexID, date, lang string) ([]models.MoexIndexCompositionEntry, error) {
	if strings.TrimSpace(lang) == "" {
		lang = "en"
	}
	return s.client.FetchComposition(ctx, indexID, date, lang)
}

func (s *MoexService) ListIndexCompositionTickers(ctx context.Context, indexID, date string) ([]MoexIndexTickerWindow, error) {
	return s.client.FetchIndexTickerWindows(ctx, indexID, date)
}

func (s *MoexService) GetIndexTickerCompositionHistory(ctx context.Context, indexID, ticker, from, till, lang string) ([]models.MoexIndexCompositionEntry, error) {
	if strings.TrimSpace(lang) == "" {
		lang = "en"
	}
	return s.client.FetchTickerCompositionHistory(ctx, indexID, ticker, from, till, lang)
}

func (s *MoexService) GetIndexCompositionSeries(ctx context.Context, indexID string, tickers []string, from, till string, intervalDays int, lang string) (map[string][]models.MoexIndexTickerAnalyticsPoint, error) {
	if strings.TrimSpace(lang) == "" {
		lang = "en"
	}

	result := make(map[string][]models.MoexIndexTickerAnalyticsPoint, len(tickers))
	for _, ticker := range tickers {
		points, err := s.client.FetchTickerAnalytics(ctx, indexID, ticker, from, till, lang)
		if err != nil {
			if isMoexStatus(err, http.StatusNotFound, http.StatusBadRequest) {
				result[ticker] = []models.MoexIndexTickerAnalyticsPoint{}
				continue
			}
			return nil, err
		}
		result[ticker] = downsampleTickerSeries(points, from, till, intervalDays)
	}
	return result, nil
}

func isMoexStatus(err error, statuses ...int) bool {
	var httpErr *moexHTTPError
	if !errors.As(err, &httpErr) {
		return false
	}
	for _, status := range statuses {
		if httpErr.Status == status {
			return true
		}
	}
	return false
}

func parseDate(value string) (time.Time, bool) {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
}

func resolveIntervalDaysFromHistory(points []models.MoexIndexHistoryPoint, intervalDays int) int {
	if intervalDays > 0 {
		return intervalDays
	}
	points = normalizeHistory(points)
	if len(points) < 2 {
		return 1
	}
	start, okStart := parseDate(points[0].TradeDate)
	end, okEnd := parseDate(points[len(points)-1].TradeDate)
	if !okStart || !okEnd {
		return 1
	}
	rangeDays := int(math.Abs(end.Sub(start).Hours() / 24))
	if rangeDays <= 0 {
		return 1
	}
	desired := int(math.Ceil(float64(rangeDays) / float64(moexDefaultTargetPoints)))
	if desired < 1 {
		desired = 1
	}
	return pickClosestInterval(desired)
}

func pickClosestInterval(desired int) int {
	if desired <= 1 {
		return 1
	}
	closest := moexIntervals[0]
	diff := math.Abs(float64(desired - closest))
	for _, candidate := range moexIntervals[1:] {
		next := math.Abs(float64(desired - candidate))
		if next < diff {
			diff = next
			closest = candidate
		}
	}
	return closest
}

func normalizeHistory(points []models.MoexIndexHistoryPoint) []models.MoexIndexHistoryPoint {
	normalized := make([]models.MoexIndexHistoryPoint, 0, len(points))
	for _, point := range points {
		if point.TradeDate == "" || point.Close == nil {
			continue
		}
		normalized = append(normalized, point)
	}
	sort.Slice(normalized, func(i, j int) bool {
		return normalized[i].TradeDate < normalized[j].TradeDate
	})
	return normalized
}

func downsampleHistory(points []models.MoexIndexHistoryPoint, intervalDays int) []models.MoexIndexHistoryPoint {
	normalized := normalizeHistory(points)
	if intervalDays <= 1 {
		return normalized
	}

	result := make([]models.MoexIndexHistoryPoint, 0)
	var bucketStart time.Time
	bucket := make([]models.MoexIndexHistoryPoint, 0)

	flush := func() {
		if len(bucket) == 0 {
			return
		}
		first := bucket[0]
		last := bucket[len(bucket)-1]
		if last.Close == nil {
			return
		}
		open := first.Open
		if open == nil {
			open = first.Close
		}
		closeValue := last.Close
		highValue := math.Inf(-1)
		lowValue := math.Inf(1)
		for _, point := range bucket {
			if point.Close == nil {
				continue
			}
			close := *point.Close
			high := close
			low := close
			if point.High != nil {
				high = *point.High
			}
			if point.Low != nil {
				low = *point.Low
			}
			if high > highValue {
				highValue = high
			}
			if low < lowValue {
				lowValue = low
			}
		}
		if math.IsInf(highValue, 0) || math.IsNaN(highValue) {
			highValue = *closeValue
		}
		if math.IsInf(lowValue, 0) || math.IsNaN(lowValue) {
			lowValue = *closeValue
		}
		result = append(result, models.MoexIndexHistoryPoint{
			TradeDate: last.TradeDate,
			Open:      open,
			High:      floatPtr(highValue),
			Low:       floatPtr(lowValue),
			Close:     closeValue,
		})
	}

	for _, point := range normalized {
		parsed, ok := parseDate(point.TradeDate)
		if !ok {
			continue
		}
		if bucketStart.IsZero() {
			bucketStart = parsed
			bucket = []models.MoexIndexHistoryPoint{point}
			continue
		}
		diff := int(math.Abs(parsed.Sub(bucketStart).Hours() / 24))
		if diff < intervalDays {
			bucket = append(bucket, point)
			continue
		}
		flush()
		bucketStart = parsed
		bucket = []models.MoexIndexHistoryPoint{point}
	}
	flush()

	return result
}

func downsampleTickerSeries(points []models.MoexIndexTickerAnalyticsPoint, from, till string, intervalDays int) []models.MoexIndexTickerAnalyticsPoint {
	normalized := make([]models.MoexIndexTickerAnalyticsPoint, 0, len(points))
	for _, point := range points {
		if point.TradeDate == "" || point.Weight == nil {
			continue
		}
		normalized = append(normalized, point)
	}
	sort.Slice(normalized, func(i, j int) bool {
		return normalized[i].TradeDate < normalized[j].TradeDate
	})

	if len(normalized) == 0 {
		return []models.MoexIndexTickerAnalyticsPoint{}
	}

	startDate, okStart := parseDate(from)
	endDate, okEnd := parseDate(till)
	if !okStart {
		if parsed, ok := parseDate(normalized[0].TradeDate); ok {
			startDate = parsed
			okStart = true
		}
	}
	if !okEnd {
		if parsed, ok := parseDate(normalized[len(normalized)-1].TradeDate); ok {
			endDate = parsed
			okEnd = true
		}
	}
	if !okStart || !okEnd {
		return normalized
	}

	if startDate.After(endDate) {
		startDate, endDate = endDate, startDate
	}

	if intervalDays <= 0 {
		rangeDays := int(math.Abs(endDate.Sub(startDate).Hours() / 24))
		if rangeDays <= 0 {
			intervalDays = 1
		} else {
			desired := int(math.Ceil(float64(rangeDays) / float64(moexDefaultTargetPoints)))
			if desired < 1 {
				desired = 1
			}
			intervalDays = pickClosestInterval(desired)
		}
	}

	if intervalDays <= 1 {
		return normalized
	}

	result := make([]models.MoexIndexTickerAnalyticsPoint, 0)
	index := 0
	for startDate.Before(endDate) || startDate.Equal(endDate) {
		bucketEnd := startDate.AddDate(0, 0, intervalDays-1)
		if bucketEnd.After(endDate) {
			bucketEnd = endDate
		}
		label := bucketEnd.Format("2006-01-02")

		var value *float64
		for index < len(normalized) {
			pointDate, ok := parseDate(normalized[index].TradeDate)
			if !ok {
				index++
				continue
			}
			if pointDate.Before(startDate) {
				index++
				continue
			}
			if !pointDate.After(bucketEnd) {
				value = normalized[index].Weight
				index++
				continue
			}
			break
		}
		if value == nil {
			zero := 0.0
			value = &zero
		}
		result = append(result, models.MoexIndexTickerAnalyticsPoint{
			TradeDate: label,
			Weight:    value,
		})

		startDate = startDate.AddDate(0, 0, intervalDays)
	}
	return result
}

func floatPtr(value float64) *float64 {
	return &value
}
