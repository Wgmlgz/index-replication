package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"server/internal/models"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	moexIndexColumns        = "SECID,SHORTNAME,NAME,CURRENCYID,DECIMALS,BOARDID,CALCMODE,ANNUALHIGH,ANNUALLOW"
	moexIndexGroupID        = 12
	moexDefaultTargetPoints = 300
	moexDefaultPageSize     = 1000
	moexMaxIterations       = 100
)

var moexIntervals = []int{1, 2, 3, 7, 14, 30}

type MoexService struct {
	baseURL string
	client  *http.Client
}

type moexHTTPError struct {
	Status int
	URL    string
	Body   string
}

func (e *moexHTTPError) Error() string {
	return fmt.Sprintf("moex upstream status %d", e.Status)
}

func NewMoexService(baseURL string) *MoexService {
	normalized := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if normalized == "" {
		normalized = "https://iss.amogos.pro/iss"
	}
	return &MoexService{
		baseURL: normalized,
		client: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

type moexTable struct {
	Columns []string        `json:"columns"`
	Data    [][]interface{} `json:"data"`
}

type moexSecuritiesResponse struct {
	Securities moexTable `json:"securities"`
}

type moexIndexCollectionsResponse struct {
	SecurityCollections *moexTable `json:"securitycollections"`
}

type moexHistoryResponse struct {
	History       moexTable  `json:"history"`
	HistoryCursor *moexTable `json:"history.cursor"`
}

type moexIndexAnalyticsResponse struct {
	Analytics       moexTable  `json:"analytics"`
	AnalyticsCursor *moexTable `json:"analytics.cursor"`
}

type moexIndexTickerAnalyticsResponse struct {
	Ticker       moexTable  `json:"ticker"`
	TickerCursor *moexTable `json:"ticker.cursor"`
}

func (s *MoexService) GetIndexesOverview(ctx context.Context, lang string) (models.MoexIndexesOverviewResponse, error) {
	if strings.TrimSpace(lang) == "" {
		lang = "ru"
	}

	indexes, err := s.fetchIndexes(ctx, lang)
	if err != nil {
		return models.MoexIndexesOverviewResponse{}, err
	}

	collections, err := s.fetchCollections(ctx, lang)
	if err != nil {
		return models.MoexIndexesOverviewResponse{}, err
	}

	memberships, err := s.fetchCollectionMemberships(ctx, lang, collections)
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
	points, err := s.fetchHistory(ctx, secid, from, till)
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
	return s.fetchComposition(ctx, indexID, date, lang)
}

func (s *MoexService) GetIndexCompositionSeries(ctx context.Context, indexID string, tickers []string, from, till string, intervalDays int, lang string) (map[string][]models.MoexIndexTickerAnalyticsPoint, error) {
	if strings.TrimSpace(lang) == "" {
		lang = "en"
	}

	result := make(map[string][]models.MoexIndexTickerAnalyticsPoint, len(tickers))
	for _, ticker := range tickers {
		points, err := s.fetchTickerAnalytics(ctx, indexID, ticker, from, till, lang)
		if err != nil {
			if isMoexStatus(err, http.StatusNotFound, http.StatusBadRequest) {
				result[ticker] = []models.MoexIndexTickerAnalyticsPoint{}
				continue
			}
			return nil, err
		}
		series := downsampleTickerSeries(points, from, till, intervalDays)
		result[ticker] = series
	}
	return result, nil
}

func (s *MoexService) fetchIndexes(ctx context.Context, lang string) ([]models.MoexIndex, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("lang", lang)
	params.Set("securities.columns", moexIndexColumns)

	var payload moexSecuritiesResponse
	if err := s.get(ctx, "engines/stock/markets/index/securities.json", params, &payload); err != nil {
		return nil, err
	}

	rows := tableToObjects(payload.Securities)
	indexes := make([]models.MoexIndex, 0, len(rows))
	for _, row := range rows {
		secid := asString(getValue(row, "SECID", "secid"))
		if secid == "" {
			continue
		}
		shortName := asString(getValue(row, "SHORTNAME", "shortname"))
		name := asString(getValue(row, "NAME", "name"))
		if shortName == "" {
			shortName = name
		}
		if name == "" {
			name = shortName
		}
		indexes = append(indexes, models.MoexIndex{
			Secid:      secid,
			ShortName:  shortName,
			Name:       name,
			Currency:   asStringPtr(getValue(row, "CURRENCYID", "currencyid")),
			Decimals:   asIntPtr(getValue(row, "DECIMALS", "decimals")),
			BoardID:    asStringPtr(getValue(row, "BOARDID", "boardid")),
			CalcMode:   asStringPtr(getValue(row, "CALCMODE", "calcmode")),
			AnnualHigh: asFloatPtr(getValue(row, "ANNUALHIGH", "annualhigh")),
			AnnualLow:  asFloatPtr(getValue(row, "ANNUALLOW", "annuallow")),
		})
	}

	return indexes, nil
}

func (s *MoexService) fetchCollections(ctx context.Context, lang string) ([]models.MoexIndexCollection, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("lang", lang)

	var payload moexIndexCollectionsResponse
	if err := s.get(ctx, "index.json", params, &payload); err != nil {
		return nil, err
	}

	if payload.SecurityCollections == nil {
		return []models.MoexIndexCollection{}, nil
	}

	rows := tableToObjects(*payload.SecurityCollections)
	collections := make([]models.MoexIndexCollection, 0, len(rows))
	for _, row := range rows {
		id := asIntPtr(getValue(row, "id", "ID"))
		name := asString(getValue(row, "name", "NAME"))
		title := asString(getValue(row, "title", "TITLE"))
		if title == "" {
			title = name
		}
		securityGroupID := asIntPtr(getValue(row, "security_group_id", "SECURITY_GROUP_ID"))
		if securityGroupID == nil || *securityGroupID != moexIndexGroupID {
			continue
		}

		collections = append(collections, models.MoexIndexCollection{
			ID:              intOrZero(id),
			Name:            name,
			Title:           title,
			SecurityGroupID: securityGroupID,
		})
	}
	return collections, nil
}

func (s *MoexService) fetchCollectionMemberships(ctx context.Context, lang string, collections []models.MoexIndexCollection) (map[string][]string, error) {
	memberships := make(map[string][]string)
	for _, collection := range collections {
		if collection.Name == "" || collection.Name == "stock_index_all" {
			continue
		}

		params := url.Values{}
		params.Set("iss.meta", "off")
		params.Set("lang", lang)
		params.Set("security_collection", collection.Name)
		params.Set("securities.columns", "SECID")

		var payload moexSecuritiesResponse
		if err := s.get(ctx, "engines/stock/markets/index/securities.json", params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.Securities)
		for _, row := range rows {
			secid := strings.ToUpper(asString(getValue(row, "SECID", "secid")))
			if secid == "" {
				continue
			}
			memberships[secid] = appendUnique(memberships[secid], collection.Name)
		}
	}
	return memberships, nil
}

type historyPoint struct {
	TradeDate string
	Close     *float64
	Open      *float64
	High      *float64
	Low       *float64
}

func (s *MoexService) fetchHistory(ctx context.Context, secid, from, till string) ([]historyPoint, error) {
	start := 0
	iterations := 0
	results := make([]historyPoint, 0)

	for iterations < moexMaxIterations {
		iterations++
		params := url.Values{}
		params.Set("iss.meta", "off")
		params.Set("history.columns", "TRADEDATE,CLOSE,OPEN,HIGH,LOW")
		params.Set("limit", strconv.Itoa(moexDefaultPageSize))
		params.Set("start", strconv.Itoa(start))
		if from != "" {
			params.Set("from", from)
		}
		if till != "" {
			params.Set("till", till)
		}

		var payload moexHistoryResponse
		if err := s.get(ctx, fmt.Sprintf("history/engines/stock/markets/index/securities/%s.json", url.PathEscape(secid)), params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.History)
		for _, row := range rows {
			results = append(results, historyPoint{
				TradeDate: asString(getValue(row, "TRADEDATE", "tradedate")),
				Close:     asFloatPtr(getValue(row, "CLOSE", "close")),
				Open:      asFloatPtr(getValue(row, "OPEN", "open")),
				High:      asFloatPtr(getValue(row, "HIGH", "high")),
				Low:       asFloatPtr(getValue(row, "LOW", "low")),
			})
		}

		total, pageSize, ok := readCursor(payload.HistoryCursor)
		if !ok {
			break
		}
		start += pageSize
		if total >= 0 && start >= total {
			break
		}
		if len(rows) == 0 {
			break
		}
	}

	return results, nil
}

func (s *MoexService) fetchComposition(ctx context.Context, indexID, date, lang string) ([]models.MoexIndexCompositionEntry, error) {
	start := 0
	iterations := 0
	results := make([]models.MoexIndexCompositionEntry, 0)

	for iterations < moexMaxIterations {
		iterations++
		params := url.Values{}
		params.Set("iss.meta", "off")
		params.Set("lang", lang)
		params.Set("tradingsession", "3")
		params.Set("limit", strconv.Itoa(moexDefaultPageSize))
		params.Set("start", strconv.Itoa(start))
		if date != "" {
			params.Set("date", date)
		}

		var payload moexIndexAnalyticsResponse
		if err := s.get(ctx, fmt.Sprintf("statistics/engines/stock/markets/index/analytics/%s.json", url.PathEscape(indexID)), params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.Analytics)
		for _, row := range rows {
			entry := models.MoexIndexCompositionEntry{
				IndexID:          asString(getValue(row, "INDEXID", "indexid")),
				TradeDate:        asString(getValue(row, "TRADEDATE", "tradedate")),
				Ticker:           asString(getValue(row, "TICKER", "ticker")),
				ShortName:        asString(getValue(row, "SHORTNAMES", "shortnames", "SHORTNAME", "shortname")),
				SecID:            asString(getValue(row, "SECIDS", "secids", "SECID", "secid")),
				Weight:           asFloatPtr(getValue(row, "WEIGHT", "weight")),
				TradeSessionDate: asStringPtr(getValue(row, "TRADE_SESSION_DATE", "trade_session_date", "TRADESESSIONDATE", "tradeSessionDate")),
			}
			if entry.Ticker == "" || entry.TradeDate == "" {
				continue
			}
			if entry.ShortName == "" {
				entry.ShortName = entry.Ticker
			}
			results = append(results, entry)
		}

		total, pageSize, ok := readCursor(payload.AnalyticsCursor)
		if !ok {
			break
		}
		start += pageSize
		if total >= 0 && start >= total {
			break
		}
		if len(rows) == 0 {
			break
		}
	}

	return results, nil
}

func (s *MoexService) fetchTickerAnalytics(ctx context.Context, indexID, ticker, from, till, lang string) ([]models.MoexIndexTickerAnalyticsPoint, error) {
	start := 0
	iterations := 0
	results := make([]models.MoexIndexTickerAnalyticsPoint, 0)

	for iterations < moexMaxIterations {
		iterations++
		params := url.Values{}
		params.Set("iss.meta", "off")
		params.Set("lang", lang)
		params.Set("tradingsession", "3")
		params.Set("limit", strconv.Itoa(moexDefaultPageSize))
		params.Set("start", strconv.Itoa(start))
		if from != "" {
			params.Set("from", from)
		}
		if till != "" {
			params.Set("till", till)
		}

		var payload moexIndexTickerAnalyticsResponse
		if err := s.get(ctx, fmt.Sprintf("statistics/engines/stock/markets/index/analytics/%s/tickers/%s.json", url.PathEscape(indexID), url.PathEscape(ticker)), params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.Ticker)
		for _, row := range rows {
			point := models.MoexIndexTickerAnalyticsPoint{
				TradeDate: asString(getValue(row, "TRADEDATE", "tradedate")),
				Weight:    asFloatPtr(getValue(row, "WEIGHT", "weight")),
			}
			if point.TradeDate == "" {
				continue
			}
			results = append(results, point)
		}

		total, pageSize, ok := readCursor(payload.TickerCursor)
		if !ok {
			break
		}
		start += pageSize
		if total >= 0 && start >= total {
			break
		}
		if len(rows) == 0 {
			break
		}
	}

	return results, nil
}

func (s *MoexService) get(ctx context.Context, path string, params url.Values, target interface{}) error {
	urlStr := fmt.Sprintf("%s/%s", s.baseURL, strings.TrimLeft(path, "/"))
	if params != nil && len(params) > 0 {
		urlStr = fmt.Sprintf("%s?%s", urlStr, params.Encode())
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return &moexHTTPError{
			Status: resp.StatusCode,
			URL:    urlStr,
			Body:   strings.TrimSpace(string(body)),
		}
	}

	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()
	return decoder.Decode(target)
}

func tableToObjects(table moexTable) []map[string]interface{} {
	rows := make([]map[string]interface{}, 0, len(table.Data))
	for _, row := range table.Data {
		record := make(map[string]interface{}, len(table.Columns))
		for i, column := range table.Columns {
			if i < len(row) {
				record[column] = row[i]
			} else {
				record[column] = nil
			}
		}
		rows = append(rows, record)
	}
	return rows
}

func getValue(row map[string]interface{}, keys ...string) interface{} {
	for _, key := range keys {
		if value, ok := row[key]; ok {
			return value
		}
	}
	return nil
}

func asString(value interface{}) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case json.Number:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

func asStringPtr(value interface{}) *string {
	str := strings.TrimSpace(asString(value))
	if str == "" {
		return nil
	}
	return &str
}

func asFloatPtr(value interface{}) *float64 {
	switch v := value.(type) {
	case nil:
		return nil
	case float64:
		return &v
	case float32:
		f := float64(v)
		return &f
	case int:
		f := float64(v)
		return &f
	case int64:
		f := float64(v)
		return &f
	case json.Number:
		if f, err := v.Float64(); err == nil {
			return &f
		}
	case string:
		if strings.TrimSpace(v) == "" {
			return nil
		}
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return &f
		}
	}
	return nil
}

func asIntPtr(value interface{}) *int {
	switch v := value.(type) {
	case nil:
		return nil
	case int:
		return &v
	case int64:
		i := int(v)
		return &i
	case float64:
		i := int(v)
		return &i
	case json.Number:
		if i64, err := v.Int64(); err == nil {
			i := int(i64)
			return &i
		}
	case string:
		if strings.TrimSpace(v) == "" {
			return nil
		}
		if i, err := strconv.Atoi(v); err == nil {
			return &i
		}
	}
	return nil
}

func intOrZero(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}

func appendUnique(values []string, next string) []string {
	for _, value := range values {
		if value == next {
			return values
		}
	}
	return append(values, next)
}

func readCursor(table *moexTable) (int, int, bool) {
	if table == nil {
		return -1, 0, false
	}
	rows := tableToObjects(*table)
	if len(rows) == 0 {
		return -1, 0, false
	}
	row := rows[0]
	total := asIntPtr(getValue(row, "TOTAL", "total"))
	pageSize := asIntPtr(getValue(row, "PAGESIZE", "pagesize"))
	if total == nil || pageSize == nil {
		return -1, 0, false
	}
	return *total, *pageSize, true
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

func resolveIntervalDaysFromHistory(points []historyPoint, intervalDays int) int {
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

func normalizeHistory(points []historyPoint) []historyPoint {
	normalized := make([]historyPoint, 0, len(points))
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

func downsampleHistory(points []historyPoint, intervalDays int) []models.MoexIndexHistoryPoint {
	normalized := normalizeHistory(points)
	if intervalDays <= 1 {
		result := make([]models.MoexIndexHistoryPoint, 0, len(normalized))
		for _, point := range normalized {
			result = append(result, models.MoexIndexHistoryPoint{
				TradeDate: point.TradeDate,
				Close:     point.Close,
				Open:      point.Open,
				High:      point.High,
				Low:       point.Low,
			})
		}
		return result
	}

	result := make([]models.MoexIndexHistoryPoint, 0)
	var bucketStart time.Time
	bucket := make([]historyPoint, 0)

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
			bucket = []historyPoint{point}
			continue
		}
		diff := int(math.Abs(parsed.Sub(bucketStart).Hours() / 24))
		if diff < intervalDays {
			bucket = append(bucket, point)
			continue
		}
		flush()
		bucketStart = parsed
		bucket = []historyPoint{point}
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
