package moex

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"net/url"
	moexdomain "server/internal/moex/domain"
	"strconv"
	"strings"
	"time"
)

const (
	defaultMoexBaseURL  = "https://iss.moex.com/iss"
	moexIndexColumns    = "SECID,SHORTNAME,NAME,CURRENCYID,DECIMALS,BOARDID,CALCMODE,ANNUALHIGH,ANNUALLOW"
	moexIndexGroupID    = 12
	moexDefaultPageSize = 1000
	moexMaxIterations   = 100

	moexRequestMaxAttempts  = 5
	moexRetryInitialBackoff = 500 * time.Millisecond
	moexRetryMaximumBackoff = 10 * time.Second
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

	var lastErr error
	for attempt := 1; attempt <= moexRequestMaxAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}

		lastErr = c.getOnce(ctx, urlStr, target)
		if lastErr == nil {
			return nil
		}
		if attempt == moexRequestMaxAttempts || !isRetryableMoexError(lastErr) {
			return lastErr
		}

		backoff := moexBackoffForAttempt(attempt)
		log.Printf(
			"[MOEX] request retry method=%s url=%s next_attempt=%d/%d backoff=%s err=%v",
			http.MethodGet,
			urlStr,
			attempt+1,
			moexRequestMaxAttempts,
			backoff,
			lastErr,
		)

		if err := waitForRetry(ctx, backoff); err != nil {
			return err
		}
	}

	return lastErr
}

func (c *moexISSClient) getOnce(ctx context.Context, urlStr string, target interface{}) error {
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

func isRetryableMoexError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}

	var httpErr *moexHTTPError
	if errors.As(err, &httpErr) {
		return isRetryableMoexStatus(httpErr.Status)
	}

	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	return errors.Is(err, context.DeadlineExceeded)
}

func isRetryableMoexStatus(status int) bool {
	return status >= 100
}

func moexBackoffForAttempt(attempt int) time.Duration {
	if attempt <= 1 {
		return moexRetryInitialBackoff
	}

	backoff := moexRetryInitialBackoff
	for i := 1; i < attempt; i++ {
		backoff *= 2
		if backoff >= moexRetryMaximumBackoff {
			return moexRetryMaximumBackoff
		}
	}
	return backoff
}

func waitForRetry(ctx context.Context, backoff time.Duration) error {
	timer := time.NewTimer(backoff)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

type moexTable struct {
	Columns []string        `json:"columns"`
	Data    [][]interface{} `json:"data"`
}

type moexSecuritiesPayload struct {
	Securities moexTable `json:"securities"`
}

type moexIndexCollectionsPayload struct {
	SecurityCollections *moexTable `json:"securitycollections"`
}

type moexHistoryPayload struct {
	History       moexTable  `json:"history"`
	HistoryCursor *moexTable `json:"history.cursor"`
}

type moexIndexAnalyticsPayload struct {
	Analytics       moexTable  `json:"analytics"`
	AnalyticsCursor *moexTable `json:"analytics.cursor"`
}

type moexIndexTickerAnalyticsPayload struct {
	Ticker       moexTable  `json:"ticker"`
	TickerCursor *moexTable `json:"ticker.cursor"`
}

type moexIndexTickersPayload struct {
	Tickers moexTable `json:"tickers"`
}

type moexEnginePayload struct {
	Engine    moexTable `json:"engine"`
	Timetable moexTable `json:"timetable"`
	Daily     moexTable `json:"dailytable"`
}

func (c *moexISSClient) FetchIndexes(ctx context.Context, lang string) ([]moexdomain.Index, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("lang", lang)
	params.Set("securities.columns", moexIndexColumns)

	var payload moexSecuritiesPayload
	if err := c.get(ctx, "engines/stock/markets/index/securities.json", params, &payload); err != nil {
		return nil, err
	}

	rows := tableToObjects(payload.Securities)
	indexes := make([]moexdomain.Index, 0, len(rows))
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
		indexes = append(indexes, moexdomain.Index{
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

func (c *moexISSClient) FetchEngineSchedule(
	ctx context.Context,
	engine, lang string,
	from *time.Time,
	to *time.Time,
) (moexdomain.EngineSchedule, error) {
	engine = strings.TrimSpace(engine)
	if engine == "" {
		engine = "stock"
	}
	lang = strings.TrimSpace(lang)
	if lang == "" {
		lang = "en"
	}

	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("lang", lang)
	params.Set("timetable.columns", "week_day,is_work_day,start_time,stop_time")
	params.Set("dailytable.columns", "date,is_work_day,start_time,stop_time")
	params.Set("engine.columns", "NAME")
	if from != nil {
		params.Set("from", from.UTC().Format("2006-01-02"))
	}
	if to != nil {
		params.Set("till", to.UTC().Format("2006-01-02"))
	}

	var payload moexEnginePayload
	if err := c.get(ctx, fmt.Sprintf("engines/%s.json", url.PathEscape(engine)), params, &payload); err != nil {
		return moexdomain.EngineSchedule{}, err
	}

	result := moexdomain.EngineSchedule{
		Engine:    engine,
		Timetable: []moexdomain.EngineWeeklySchedule{},
		Daily:     []moexdomain.EngineDailySchedule{},
	}

	engineRows := tableToObjects(payload.Engine)
	if len(engineRows) > 0 {
		if name := strings.TrimSpace(asString(getValue(engineRows[0], "NAME", "name"))); name != "" {
			result.Engine = strings.ToLower(name)
		}
	}

	timetableRows := tableToObjects(payload.Timetable)
	result.Timetable = make([]moexdomain.EngineWeeklySchedule, 0, len(timetableRows))
	for _, row := range timetableRows {
		weekDay := asIntPtr(getValue(row, "week_day", "WEEK_DAY", "weekday", "WEEKDAY"))
		if weekDay == nil || *weekDay <= 0 {
			continue
		}
		isWorkDay := asIntPtr(getValue(row, "is_work_day", "IS_WORK_DAY"))
		result.Timetable = append(result.Timetable, moexdomain.EngineWeeklySchedule{
			WeekDay:   *weekDay,
			IsWorkDay: isWorkDay != nil && *isWorkDay != 0,
			StartTime: asStringPtr(getValue(row, "start_time", "START_TIME", "start", "START")),
			StopTime:  asStringPtr(getValue(row, "stop_time", "STOP_TIME", "stop", "STOP")),
		})
	}

	dailyRows := tableToObjects(payload.Daily)
	result.Daily = make([]moexdomain.EngineDailySchedule, 0, len(dailyRows))
	for _, row := range dailyRows {
		date := strings.TrimSpace(asString(getValue(row, "date", "DATE")))
		if date == "" {
			continue
		}
		isWorkDay := asIntPtr(getValue(row, "is_work_day", "IS_WORK_DAY"))
		result.Daily = append(result.Daily, moexdomain.EngineDailySchedule{
			Date:      date,
			IsWorkDay: isWorkDay != nil && *isWorkDay != 0,
			StartTime: asStringPtr(getValue(row, "start_time", "START_TIME", "start", "START")),
			StopTime:  asStringPtr(getValue(row, "stop_time", "STOP_TIME", "stop", "STOP")),
		})
	}

	return result, nil
}

func (c *moexISSClient) FetchCollections(ctx context.Context, lang string) ([]moexdomain.IndexCollection, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("lang", lang)

	var payload moexIndexCollectionsPayload
	if err := c.get(ctx, "index.json", params, &payload); err != nil {
		return nil, err
	}
	if payload.SecurityCollections == nil {
		return []moexdomain.IndexCollection{}, nil
	}

	rows := tableToObjects(*payload.SecurityCollections)
	collections := make([]moexdomain.IndexCollection, 0, len(rows))
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

		collections = append(collections, moexdomain.IndexCollection{
			ID:              intOrZero(id),
			Name:            name,
			Title:           title,
			SecurityGroupID: securityGroupID,
		})
	}
	return collections, nil
}

func (c *moexISSClient) FetchCollectionMemberships(ctx context.Context, lang string, collections []moexdomain.IndexCollection) (map[string][]string, error) {
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

		var payload moexSecuritiesPayload
		if err := c.get(ctx, "engines/stock/markets/index/securities.json", params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.Securities)
		for _, row := range rows {
			secid := asString(getValue(row, "SECID", "secid"))
			if secid == "" {
				continue
			}
			memberships[secid] = appendUnique(memberships[secid], collection.Name)
		}
	}
	return memberships, nil
}

func (c *moexISSClient) FetchHistory(ctx context.Context, secid, from, till string) ([]moexdomain.IndexHistoryPoint, error) {
	start := 0
	iterations := 0
	results := make([]moexdomain.IndexHistoryPoint, 0)

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

		var payload moexHistoryPayload
		if err := c.get(ctx, fmt.Sprintf("history/engines/stock/markets/index/securities/%s.json", url.PathEscape(secid)), params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.History)
		for _, row := range rows {
			results = append(results, moexdomain.IndexHistoryPoint{
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

func (c *moexISSClient) FetchShareSecurityHistory(ctx context.Context, secid, board, from, till string) ([]moexdomain.IndexHistoryPoint, error) {
	start := 0
	iterations := 0
	results := make([]moexdomain.IndexHistoryPoint, 0)

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

		var payload moexHistoryPayload
		if err := c.get(
			ctx,
			fmt.Sprintf(
				"history/engines/stock/markets/shares/boards/%s/securities/%s.json",
				url.PathEscape(board),
				url.PathEscape(secid),
			),
			params,
			&payload,
		); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.History)
		for _, row := range rows {
			results = append(results, moexdomain.IndexHistoryPoint{
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

func (c *moexISSClient) FetchShareSecurityCurrency(ctx context.Context, secid, board string) (string, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("securities.columns", "SECID,CURRENCYID,FACEUNIT")

	var payload moexSecuritiesPayload
	if err := c.get(
		ctx,
		fmt.Sprintf(
			"engines/stock/markets/shares/boards/%s/securities/%s.json",
			url.PathEscape(board),
			url.PathEscape(secid),
		),
		params,
		&payload,
	); err != nil {
		return "", err
	}

	rows := tableToObjects(payload.Securities)
	for _, row := range rows {
		currency := strings.ToUpper(strings.TrimSpace(asString(getValue(row, "CURRENCYID", "currencyid"))))
		if currency != "" {
			return currency, nil
		}
		currency = strings.ToUpper(strings.TrimSpace(asString(getValue(row, "FACEUNIT", "faceunit"))))
		if currency != "" {
			return currency, nil
		}
	}
	return "", nil
}

func (c *moexISSClient) FetchShareSecurityLotSize(ctx context.Context, secid, board string) (int64, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("securities.columns", "SECID,LOTSIZE")

	var payload moexSecuritiesPayload
	if err := c.get(
		ctx,
		fmt.Sprintf(
			"engines/stock/markets/shares/boards/%s/securities/%s.json",
			url.PathEscape(board),
			url.PathEscape(secid),
		),
		params,
		&payload,
	); err != nil {
		return 0, err
	}

	rows := tableToObjects(payload.Securities)
	for _, row := range rows {
		lotSize := asIntPtr(getValue(row, "LOTSIZE", "lotsize"))
		if lotSize != nil && *lotSize > 0 {
			return int64(*lotSize), nil
		}
	}
	return 0, nil
}

func (c *moexISSClient) FetchComposition(ctx context.Context, indexID, date, lang string) ([]moexdomain.IndexCompositionEntry, error) {
	start := 0
	iterations := 0
	results := make([]moexdomain.IndexCompositionEntry, 0)

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

		var payload moexIndexAnalyticsPayload
		if err := c.get(ctx, fmt.Sprintf("statistics/engines/stock/markets/index/analytics/%s.json", url.PathEscape(indexID)), params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.Analytics)
		for _, row := range rows {
			entry := moexdomain.IndexCompositionEntry{
				IndexID:          asString(getValue(row, "INDEXID", "indexid")),
				TradeDate:        asString(getValue(row, "TRADEDATE", "tradedate")),
				Ticker:           asString(getValue(row, "TICKER", "ticker")),
				ShortName:        asString(getValue(row, "SHORTNAMES", "shortnames", "SHORTNAME", "shortname")),
				SecID:            asString(getValue(row, "SECIDS", "secids", "SECID", "secid")),
				Weight:           resolveCompositionWeight(row),
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

func (c *moexISSClient) FetchIndexTickerWindows(ctx context.Context, indexID, date string) ([]MoexIndexTickerWindow, error) {
	params := url.Values{}
	params.Set("iss.meta", "off")
	params.Set("tradingsession", "3")
	if strings.TrimSpace(date) != "" {
		params.Set("date", strings.TrimSpace(date))
	}

	var payload moexIndexTickersPayload
	if err := c.get(ctx, fmt.Sprintf("statistics/engines/stock/markets/index/analytics/%s/tickers.json", url.PathEscape(indexID)), params, &payload); err != nil {
		return nil, err
	}

	rows := tableToObjects(payload.Tickers)
	result := make([]MoexIndexTickerWindow, 0, len(rows))
	for _, row := range rows {
		ticker := asString(getValue(row, "TICKER", "ticker"))
		if ticker == "" {
			continue
		}
		result = append(result, MoexIndexTickerWindow{
			Ticker: ticker,
			From:   strings.TrimSpace(asString(getValue(row, "FROM", "from"))),
			Till:   strings.TrimSpace(asString(getValue(row, "TILL", "till"))),
		})
	}
	return result, nil
}

func (c *moexISSClient) FetchTickerCompositionHistory(ctx context.Context, indexID, ticker, from, till, lang string) ([]moexdomain.IndexCompositionEntry, error) {
	rows, err := c.fetchTickerAnalyticsRows(ctx, indexID, ticker, from, till, lang)
	if err != nil {
		return nil, err
	}

	result := make([]moexdomain.IndexCompositionEntry, 0, len(rows))
	for _, row := range rows {
		tradeDate := asString(getValue(row, "TRADEDATE", "tradedate"))
		tickerCode := asString(getValue(row, "TICKER", "ticker"))
		if tradeDate == "" || tickerCode == "" {
			continue
		}
		entry := moexdomain.IndexCompositionEntry{
			IndexID:          asString(getValue(row, "INDEXID", "indexid")),
			TradeDate:        tradeDate,
			Ticker:           tickerCode,
			ShortName:        asString(getValue(row, "SHORTNAMES", "shortnames", "SHORTNAME", "shortname")),
			SecID:            asString(getValue(row, "SECIDS", "secids", "SECID", "secid")),
			Weight:           resolveCompositionWeight(row),
			TradeSessionDate: asStringPtr(getValue(row, "TRADE_SESSION_DATE", "trade_session_date", "TRADESESSIONDATE", "tradeSessionDate")),
		}
		if entry.ShortName == "" {
			entry.ShortName = entry.Ticker
		}
		result = append(result, entry)
	}
	return result, nil
}

func (c *moexISSClient) FetchTickerAnalytics(ctx context.Context, indexID, ticker, from, till, lang string) ([]moexdomain.IndexTickerAnalyticsPoint, error) {
	rows, err := c.fetchTickerAnalyticsRows(ctx, indexID, ticker, from, till, lang)
	if err != nil {
		return nil, err
	}
	results := make([]moexdomain.IndexTickerAnalyticsPoint, 0, len(rows))
	for _, row := range rows {
		point := moexdomain.IndexTickerAnalyticsPoint{
			TradeDate: asString(getValue(row, "TRADEDATE", "tradedate")),
			Weight:    resolveCompositionWeight(row),
		}
		if point.TradeDate == "" {
			continue
		}
		results = append(results, point)
	}
	return results, nil
}

func (c *moexISSClient) fetchTickerAnalyticsRows(ctx context.Context, indexID, ticker, from, till, lang string) ([]map[string]interface{}, error) {
	start := 0
	iterations := 0
	results := make([]map[string]interface{}, 0)

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

		var payload moexIndexTickerAnalyticsPayload
		if err := c.get(ctx, fmt.Sprintf("statistics/engines/stock/markets/index/analytics/%s/tickers/%s.json", url.PathEscape(indexID), url.PathEscape(ticker)), params, &payload); err != nil {
			return nil, err
		}

		rows := tableToObjects(payload.Ticker)
		results = append(results, rows...)

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

func resolveCompositionWeight(row map[string]interface{}) *float64 {
	weight := asFloatPtr(getValue(row, "WEIGHT", "weight"))
	if !isNilOrNearZero(weight) {
		return weight
	}

	// Some indexes (for example MOEXALLW) expose zero WEIGHT but non-zero Wi/w_factor.
	// Use it as a fallback so composition is still informative.
	fallback := asFloatPtr(getValue(row, "WI", "wi", "W_FACTOR", "w_factor"))
	if fallback == nil {
		return weight
	}
	return fallback
}

func isNilOrNearZero(value *float64) bool {
	if value == nil {
		return true
	}
	return math.Abs(*value) < 1e-12
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
