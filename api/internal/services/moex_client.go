package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"server/internal/models"
	"strconv"
	"strings"
	"time"
)

const (
	defaultMoexBaseURL  = "https://iss.amogos.pro/iss"
	moexIndexColumns    = "SECID,SHORTNAME,NAME,CURRENCYID,DECIMALS,BOARDID,CALCMODE,ANNUALHIGH,ANNUALLOW"
	moexIndexGroupID    = 12
	moexDefaultPageSize = 1000
	moexMaxIterations   = 100
)

type moexISSClient struct {
	baseURL string
	client  *http.Client
}

func newMoexISSClient(baseURL string, timeout time.Duration) *moexISSClient {
	normalized := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if normalized == "" {
		normalized = defaultMoexBaseURL
	}
	return &moexISSClient{
		baseURL: normalized,
		client: &http.Client{
			Timeout: timeout,
		},
	}
}

type moexHTTPError struct {
	Status int
	URL    string
	Body   string
}

func (e *moexHTTPError) Error() string {
	return fmt.Sprintf("moex upstream status %d", e.Status)
}

func (c *moexISSClient) get(ctx context.Context, path string, params url.Values, target interface{}) error {
	urlStr := fmt.Sprintf("%s/%s", c.baseURL, strings.TrimLeft(path, "/"))
	if params != nil && len(params) > 0 {
		urlStr = fmt.Sprintf("%s?%s", urlStr, params.Encode())
	}
	startedAt := time.Now()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		log.Printf("[MOEX] request failed method=%s url=%s duration=%s err=%v", http.MethodGet, urlStr, time.Since(startedAt).Round(time.Millisecond), err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		log.Printf("[MOEX] request upstream_error method=%s url=%s status=%d duration=%s", http.MethodGet, urlStr, resp.StatusCode, time.Since(startedAt).Round(time.Millisecond))
		return &moexHTTPError{
			Status: resp.StatusCode,
			URL:    urlStr,
			Body:   strings.TrimSpace(string(body)),
		}
	}

	decoder := json.NewDecoder(resp.Body)
	decoder.UseNumber()
	if err := decoder.Decode(target); err != nil {
		log.Printf("[MOEX] request decode_error method=%s url=%s status=%d duration=%s err=%v", http.MethodGet, urlStr, resp.StatusCode, time.Since(startedAt).Round(time.Millisecond), err)
		return err
	}
	log.Printf("[MOEX] request ok method=%s url=%s status=%d duration=%s", http.MethodGet, urlStr, resp.StatusCode, time.Since(startedAt).Round(time.Millisecond))
	return nil
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

func (c *moexISSClient) FetchIndexes(ctx context.Context, lang string) ([]models.MoexIndex, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("lang", lang)
	params.Set("securities.columns", moexIndexColumns)

	var payload moexSecuritiesResponse
	if err := c.get(ctx, "engines/stock/markets/index/securities.json", params, &payload); err != nil {
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

func (c *moexISSClient) FetchCollections(ctx context.Context, lang string) ([]models.MoexIndexCollection, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("lang", lang)

	var payload moexIndexCollectionsResponse
	if err := c.get(ctx, "index.json", params, &payload); err != nil {
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

func (c *moexISSClient) FetchCollectionMemberships(ctx context.Context, lang string, collections []models.MoexIndexCollection) (map[string][]string, error) {
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
		if err := c.get(ctx, "engines/stock/markets/index/securities.json", params, &payload); err != nil {
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

func (c *moexISSClient) FetchHistory(ctx context.Context, secid, from, till string) ([]models.MoexIndexHistoryPoint, error) {
	start := 0
	iterations := 0
	results := make([]models.MoexIndexHistoryPoint, 0)

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
		if err := c.get(ctx, fmt.Sprintf("history/engines/stock/markets/index/securities/%s.json", url.PathEscape(secid)), params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.History)
		for _, row := range rows {
			results = append(results, models.MoexIndexHistoryPoint{
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

func (c *moexISSClient) FetchComposition(ctx context.Context, indexID, date, lang string) ([]models.MoexIndexCompositionEntry, error) {
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
		if err := c.get(ctx, fmt.Sprintf("statistics/engines/stock/markets/index/analytics/%s.json", url.PathEscape(indexID)), params, &payload); err != nil {
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

func (c *moexISSClient) FetchTickerAnalytics(ctx context.Context, indexID, ticker, from, till, lang string) ([]models.MoexIndexTickerAnalyticsPoint, error) {
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
		if err := c.get(ctx, fmt.Sprintf("statistics/engines/stock/markets/index/analytics/%s/tickers/%s.json", url.PathEscape(indexID), url.PathEscape(ticker)), params, &payload); err != nil {
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
