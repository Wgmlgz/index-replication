package tbank

import (
	"context"
	"errors"
	"log"
	"math"
	"sort"
	"strings"
	"time"

	"server/internal/marketprice"

	"google.golang.org/grpc"
	pb "opensource.tbank.ru/invest/invest-go/proto"
)

type analyticsHolding struct {
	InstrumentID   string
	Ticker         string
	Name           string
	Currency       string
	Quantity       float64
	ReferencePrice float64
}

type analyticsSeriesEntry struct {
	TradeDate    string
	Ticker       string
	InstrumentID string
	Name         string
	Currency     string
	Quantity     float64
	CurrentPrice float64
	CurrentValue float64
	Weight       float64
}

type analyticsOperation struct {
	Date         time.Time
	TradeDate    string
	InstrumentID string
	Ticker       string
	Name         string
	Currency     string
	Price        float64
	Quantity     float64
	ReverseDelta float64
}

func (s *Service) GetPortfolioHistory(
	ctx context.Context,
	userID int,
	accountID string,
	from string,
	till string,
	intervalDays int,
) ([]PortfolioHistoryPoint, error) {
	fromDate, tillDate, err := parseDateRangePointers(from, till)
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}
	resolvedAccountID, err := s.resolveAccountID(ctx, conn, accountID, true, userID)
	if err != nil {
		return nil, err
	}

	portfolio, err := s.getAccountPortfolioRaw(ctx, conn, resolvedAccountID)
	if err != nil {
		return nil, err
	}
	operations, err := s.getAllExecutedOperations(ctx, conn.environment, conn.token, resolvedAccountID)
	if err != nil {
		return nil, err
	}

	rangeFrom, rangeTill := resolveAnalyticsRange(operations, fromDate, tillDate)
	dailyAnchors := buildDateLabels(rangeFrom, rangeTill)
	anchors := downsampleDateStrings(dailyAnchors, intervalDays)
	if len(anchors) == 0 {
		return []PortfolioHistoryPoint{}, nil
	}

	snapshots := s.buildCompositionSnapshotsByDate(ctx, portfolio, operations, anchors)
	points := make([]PortfolioHistoryPoint, 0, len(anchors))
	currency := strings.ToUpper(strings.TrimSpace(portfolio.TotalAmountPortfolioCurrency))
	for _, date := range anchors {
		entries := snapshots[date]
		total := 0.0
		for _, entry := range entries {
			if entry.CurrentValue > 0 {
				total += entry.CurrentValue
			}
		}
		points = append(points, PortfolioHistoryPoint{
			TradeDate:                    date,
			TotalAmountPortfolio:         total,
			TotalAmountPortfolioCurrency: currency,
		})
	}
	return points, nil
}

func (s *Service) GetPortfolioComposition(
	ctx context.Context,
	userID int,
	accountID string,
	date string,
) ([]PortfolioCompositionEntry, error) {
	preferredDate, err := parseOptionalDate(date)
	if err != nil {
		return nil, err
	}

	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}
	resolvedAccountID, err := s.resolveAccountID(ctx, conn, accountID, true, userID)
	if err != nil {
		return nil, err
	}

	portfolio, err := s.getAccountPortfolioRaw(ctx, conn, resolvedAccountID)
	if err != nil {
		return nil, err
	}
	operations, err := s.getAllExecutedOperations(ctx, conn.environment, conn.token, resolvedAccountID)
	if err != nil {
		return nil, err
	}

	anchors := resolveAnalyticsAnchors(operations, nil, nil)
	if len(anchors) == 0 {
		return []PortfolioCompositionEntry{}, nil
	}
	targetDate := anchors[len(anchors)-1]
	if preferredDate != nil {
		targetDate = targetDateAtOrBefore(anchors, *preferredDate)
		if targetDate == "" {
			return []PortfolioCompositionEntry{}, nil
		}
	}

	snapshots := s.buildCompositionSnapshotsByDate(ctx, portfolio, operations, []string{targetDate})
	entries := snapshots[targetDate]
	result := make([]PortfolioCompositionEntry, 0, len(entries))
	for _, entry := range entries {
		result = append(result, PortfolioCompositionEntry{
			TradeDate:    entry.TradeDate,
			Ticker:       entry.Ticker,
			InstrumentID: entry.InstrumentID,
			Name:         entry.Name,
			Quantity:     entry.Quantity,
			CurrentPrice: entry.CurrentPrice,
			CurrentValue: entry.CurrentValue,
			Currency:     entry.Currency,
			Weight:       entry.Weight,
		})
	}
	return result, nil
}

func (s *Service) GetPortfolioCompositionSeries(
	ctx context.Context,
	userID int,
	accountID string,
	tickers []string,
	topCount int,
	selectionMode string,
	selectionDate string,
	from string,
	till string,
	intervalDays int,
) (map[string][]PortfolioCompositionSeriesPoint, error) {
	fromDate, tillDate, err := parseDateRangePointers(from, till)
	if err != nil {
		return nil, err
	}
	baseSelectionDate, err := parseOptionalDate(selectionDate)
	if err != nil {
		return nil, err
	}

	mode := strings.ToLower(strings.TrimSpace(selectionMode))
	if mode == "" {
		mode = "fixed"
	}
	if mode != "fixed" && mode != "rolling" {
		return nil, errors.New("invalid selection mode")
	}
	if topCount < 0 {
		topCount = 0
	}

	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}
	resolvedAccountID, err := s.resolveAccountID(ctx, conn, accountID, true, userID)
	if err != nil {
		return nil, err
	}

	portfolio, err := s.getAccountPortfolioRaw(ctx, conn, resolvedAccountID)
	if err != nil {
		return nil, err
	}
	operations, err := s.getAllExecutedOperations(ctx, conn.environment, conn.token, resolvedAccountID)
	if err != nil {
		return nil, err
	}

	rangeFrom, rangeTill := resolveAnalyticsRange(operations, fromDate, tillDate)
	dailyAnchors := buildDateLabels(rangeFrom, rangeTill)
	anchors := downsampleDateStrings(dailyAnchors, intervalDays)
	if len(anchors) == 0 {
		return map[string][]PortfolioCompositionSeriesPoint{}, nil
	}

	snapshots := s.buildCompositionSnapshotsByDate(ctx, portfolio, operations, anchors)

	selectedTickers := normalizeTickers(tickers)
	if len(selectedTickers) == 0 && mode == "fixed" {
		baseDate := anchors[len(anchors)-1]
		if baseSelectionDate != nil {
			if resolved := targetDateAtOrBefore(anchors, *baseSelectionDate); resolved != "" {
				baseDate = resolved
			}
		}
		baseEntries := snapshots[baseDate]
		limit := len(baseEntries)
		if topCount > 0 && topCount < limit {
			limit = topCount
		}
		selectedTickers = make([]string, 0, limit)
		for _, entry := range baseEntries[:limit] {
			selectedTickers = append(selectedTickers, entry.Ticker)
		}
	}

	series := make(map[string][]PortfolioCompositionSeriesPoint)
	if mode == "rolling" && len(selectedTickers) == 0 {
		selectedPerDate := make(map[string]map[string]float64, len(anchors))
		unique := make(map[string]struct{})
		for _, date := range anchors {
			entries := snapshots[date]
			limit := len(entries)
			if topCount > 0 && topCount < limit {
				limit = topCount
			}
			if limit == 0 {
				continue
			}
			weights := make(map[string]float64, limit)
			for _, entry := range entries[:limit] {
				weights[entry.Ticker] = entry.Weight
				unique[entry.Ticker] = struct{}{}
			}
			selectedPerDate[date] = weights
		}

		tickerList := make([]string, 0, len(unique))
		for ticker := range unique {
			tickerList = append(tickerList, ticker)
		}
		sort.Strings(tickerList)
		for _, ticker := range tickerList {
			points := make([]PortfolioCompositionSeriesPoint, 0, len(anchors))
			for _, date := range anchors {
				weight := 0.0
				if weights, ok := selectedPerDate[date]; ok {
					weight = weights[ticker]
				}
				points = append(points, PortfolioCompositionSeriesPoint{
					TradeDate: date,
					Weight:    weight,
				})
			}
			series[ticker] = points
		}
		return series, nil
	}

	if len(selectedTickers) == 0 {
		return map[string][]PortfolioCompositionSeriesPoint{}, nil
	}

	for _, ticker := range selectedTickers {
		series[ticker] = make([]PortfolioCompositionSeriesPoint, 0, len(anchors))
	}
	for _, date := range anchors {
		weights := make(map[string]float64, len(snapshots[date]))
		for _, entry := range snapshots[date] {
			weights[entry.Ticker] = entry.Weight
		}
		for _, ticker := range selectedTickers {
			series[ticker] = append(series[ticker], PortfolioCompositionSeriesPoint{
				TradeDate: date,
				Weight:    weights[ticker],
			})
		}
	}
	return series, nil
}

func (s *Service) getAllExecutedOperations(
	ctx context.Context,
	environment string,
	token string,
	accountID string,
) ([]OperationHistoryItem, error) {
	items := make([]*pb.OperationItem, 0, 256)
	err := s.withConnection(ctx, environment, token, func(callCtx context.Context, conn *grpc.ClientConn) error {
		client := pb.NewOperationsServiceClient(conn)
		limit := int32(1000)
		state := pb.OperationState_OPERATION_STATE_EXECUTED
		cursor := ""
		page := 0

		for {
			req := &pb.GetOperationsByCursorRequest{
				AccountId: accountID,
				Limit:     &limit,
				State:     &state,
			}
			if strings.TrimSpace(cursor) != "" {
				req.Cursor = &cursor
			}

			resp, callErr := client.GetOperationsByCursor(callCtx, req)
			if callErr != nil {
				return callErr
			}
			items = append(items, resp.GetItems()...)
			if !resp.GetHasNext() {
				break
			}
			nextCursor := strings.TrimSpace(resp.GetNextCursor())
			if nextCursor == "" || nextCursor == cursor {
				break
			}
			cursor = nextCursor
			page++
			if page >= 200 {
				break
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return mapOperationsHistoryItems(items), nil
}

func (s *Service) buildCompositionSnapshotsByDate(
	ctx context.Context,
	portfolio *AccountPortfolioResponse,
	operations []OperationHistoryItem,
	dates []string,
) map[string][]analyticsSeriesEntry {
	snapshots := make(map[string][]analyticsSeriesEntry, len(dates))
	if portfolio == nil || len(dates) == 0 {
		return snapshots
	}

	holdings := buildCurrentHoldings(portfolio, operations)
	priceBooks := s.loadTBankPriceBooks(ctx, holdings, dates)
	analyticsOps := buildAnalyticsOperations(operations)
	sort.Slice(analyticsOps, func(i, j int) bool {
		return analyticsOps[i].Date.After(analyticsOps[j].Date)
	})

	descDates := make([]string, len(dates))
	copy(descDates, dates)
	sort.Slice(descDates, func(i, j int) bool { return descDates[i] > descDates[j] })

	opIndex := 0
	for _, date := range descDates {
		for opIndex < len(analyticsOps) && analyticsOps[opIndex].TradeDate > date {
			applyReverseOperation(holdings, analyticsOps[opIndex])
			opIndex++
		}
		snapshots[date] = composeEntriesForDate(date, holdings, priceBooks)
	}

	return snapshots
}

func (s *Service) loadTBankPriceBooks(
	ctx context.Context,
	holdings map[string]*analyticsHolding,
	dates []string,
) map[string]map[string]float64 {
	books := make(map[string]map[string]float64)
	if s.marketPrices == nil || len(holdings) == 0 || len(dates) == 0 {
		return books
	}

	fromDate, err := time.Parse("2006-01-02", dates[0])
	if err != nil {
		return books
	}
	tillDate, err := time.Parse("2006-01-02", dates[len(dates)-1])
	if err != nil {
		return books
	}
	if fromDate.After(tillDate) {
		fromDate, tillDate = tillDate, fromDate
	}

	for instrumentID, holding := range holdings {
		if holding == nil || strings.TrimSpace(instrumentID) == "" {
			continue
		}
		series, err := s.marketPrices.GetDailyAsOfPrices(ctx, marketprice.InstrumentRangeRequest{
			Provider:      "tbank",
			InstrumentKey: instrumentID,
			Ticker:        holding.Ticker,
			From:          fromDate,
			To:            tillDate,
		})
		if err != nil {
			log.Printf("[TBANK] market price fetch failed instrument=%s ticker=%s err=%v", instrumentID, holding.Ticker, err)
			continue
		}
		if series == nil || len(series.Prices) == 0 {
			continue
		}
		books[instrumentID] = series.Prices
	}
	return books
}

func buildCurrentHoldings(
	portfolio *AccountPortfolioResponse,
	operations []OperationHistoryItem,
) map[string]*analyticsHolding {
	holdings := make(map[string]*analyticsHolding)
	for _, position := range portfolio.Positions {
		key := normalizeInstrumentKey(position.InstrumentID, position.Figi, position.Ticker)
		if key == "" {
			continue
		}
		price := position.CurrentPrice
		if price <= 0 && position.Quantity != 0 {
			price = position.CurrentValue / position.Quantity
		}
		existing, ok := holdings[key]
		if !ok {
			holdings[key] = &analyticsHolding{
				InstrumentID:   key,
				Ticker:         normalizeTicker(position.Ticker, key),
				Name:           strings.TrimSpace(position.Name),
				Currency:       strings.ToUpper(strings.TrimSpace(position.Currency)),
				Quantity:       position.Quantity,
				ReferencePrice: price,
			}
			continue
		}
		existing.Quantity += position.Quantity
		if existing.ReferencePrice <= 0 && price > 0 {
			existing.ReferencePrice = price
		}
		if existing.Ticker == "" {
			existing.Ticker = normalizeTicker(position.Ticker, key)
		}
		if existing.Name == "" {
			existing.Name = strings.TrimSpace(position.Name)
		}
		if existing.Currency == "" {
			existing.Currency = strings.ToUpper(strings.TrimSpace(position.Currency))
		}
	}

	ops := buildAnalyticsOperations(operations)
	for _, op := range ops {
		if op.InstrumentID == "" {
			continue
		}
		holding, ok := holdings[op.InstrumentID]
		if !ok {
			holdings[op.InstrumentID] = &analyticsHolding{
				InstrumentID:   op.InstrumentID,
				Ticker:         normalizeTicker(op.Ticker, op.InstrumentID),
				Name:           op.Name,
				Currency:       op.Currency,
				ReferencePrice: op.Price,
			}
			continue
		}
		if holding.ReferencePrice <= 0 && op.Price > 0 {
			holding.ReferencePrice = op.Price
		}
		if holding.Ticker == "" {
			holding.Ticker = normalizeTicker(op.Ticker, op.InstrumentID)
		}
		if holding.Name == "" {
			holding.Name = op.Name
		}
		if holding.Currency == "" {
			holding.Currency = op.Currency
		}
	}
	return holdings
}

func buildAnalyticsOperations(operations []OperationHistoryItem) []analyticsOperation {
	result := make([]analyticsOperation, 0, len(operations))
	for _, item := range operations {
		if item.Date == nil {
			continue
		}
		key := normalizeInstrumentKey(item.InstrumentID, item.Figi, "")
		if key == "" {
			continue
		}
		qty := float64(item.QuantityDone)
		if qty <= 0 {
			qty = float64(item.Quantity)
		}
		if qty <= 0 {
			continue
		}
		delta, ok := resolveReverseDelta(item, qty)
		if !ok {
			continue
		}
		date := item.Date.UTC()
		result = append(result, analyticsOperation{
			Date:         date,
			TradeDate:    date.Format("2006-01-02"),
			InstrumentID: key,
			Ticker:       "",
			Name:         strings.TrimSpace(item.Name),
			Currency:     strings.ToUpper(strings.TrimSpace(item.PriceCurrency)),
			Price:        item.Price,
			Quantity:     qty,
			ReverseDelta: delta,
		})
	}
	return result
}

func resolveReverseDelta(item OperationHistoryItem, quantity float64) (float64, bool) {
	payment := item.Payment
	if payment < 0 {
		return -quantity, true
	}
	if payment > 0 {
		return quantity, true
	}

	typeValue := strings.ToUpper(strings.TrimSpace(item.Type))
	switch {
	case strings.Contains(typeValue, "BUY"):
		return -quantity, true
	case strings.Contains(typeValue, "SELL"):
		return quantity, true
	default:
		return 0, false
	}
}

func applyReverseOperation(holdings map[string]*analyticsHolding, operation analyticsOperation) {
	if operation.InstrumentID == "" || operation.ReverseDelta == 0 {
		return
	}
	holding, ok := holdings[operation.InstrumentID]
	if !ok {
		holding = &analyticsHolding{
			InstrumentID:   operation.InstrumentID,
			Ticker:         normalizeTicker(operation.Ticker, operation.InstrumentID),
			Name:           operation.Name,
			Currency:       operation.Currency,
			ReferencePrice: operation.Price,
		}
		holdings[operation.InstrumentID] = holding
	}
	holding.Quantity += operation.ReverseDelta
	if holding.ReferencePrice <= 0 && operation.Price > 0 {
		holding.ReferencePrice = operation.Price
	}
	if holding.Ticker == "" {
		holding.Ticker = normalizeTicker(operation.Ticker, operation.InstrumentID)
	}
	if holding.Name == "" {
		holding.Name = operation.Name
	}
	if holding.Currency == "" {
		holding.Currency = operation.Currency
	}
}

func composeEntriesForDate(
	tradeDate string,
	holdings map[string]*analyticsHolding,
	priceBooks map[string]map[string]float64,
) []analyticsSeriesEntry {
	grouped := make(map[string]*analyticsSeriesEntry)
	total := 0.0

	for instrumentID, holding := range holdings {
		if holding == nil || holding.Quantity <= 0 {
			continue
		}
		price := holding.ReferencePrice
		if byDate, exists := priceBooks[instrumentID]; exists {
			if marketPrice, ok := byDate[tradeDate]; ok && marketPrice > 0 {
				price = marketPrice
			}
		}
		if price <= 0 {
			continue
		}
		value := holding.Quantity * price
		if value <= 0 {
			continue
		}
		ticker := normalizeTicker(holding.Ticker, instrumentID)
		entry, ok := grouped[ticker]
		if !ok {
			grouped[ticker] = &analyticsSeriesEntry{
				TradeDate:    tradeDate,
				Ticker:       ticker,
				InstrumentID: instrumentID,
				Name:         holding.Name,
				Currency:     holding.Currency,
				Quantity:     holding.Quantity,
				CurrentPrice: price,
				CurrentValue: value,
			}
		} else {
			entry.Quantity += holding.Quantity
			entry.CurrentValue += value
			if entry.CurrentPrice <= 0 && price > 0 {
				entry.CurrentPrice = price
			}
			if entry.Name == "" {
				entry.Name = holding.Name
			}
			if entry.Currency == "" {
				entry.Currency = holding.Currency
			}
		}
		total += value
	}

	entries := make([]analyticsSeriesEntry, 0, len(grouped))
	for _, entry := range grouped {
		if total > 0 {
			entry.Weight = (entry.CurrentValue / total) * 100
		}
		entries = append(entries, *entry)
	}
	sort.Slice(entries, func(i, j int) bool {
		if math.Abs(entries[i].CurrentValue-entries[j].CurrentValue) > 1e-9 {
			return entries[i].CurrentValue > entries[j].CurrentValue
		}
		return entries[i].Ticker < entries[j].Ticker
	})
	return entries
}

func resolveAnalyticsRange(
	operations []OperationHistoryItem,
	fromDate *time.Time,
	tillDate *time.Time,
) (time.Time, time.Time) {
	today := dateOnlyUTC(time.Now().UTC())
	rangeTill := today
	if tillDate != nil {
		rangeTill = dateOnlyUTC(*tillDate)
	}

	rangeFrom := rangeTill
	if fromDate != nil {
		rangeFrom = dateOnlyUTC(*fromDate)
	} else {
		for _, op := range operations {
			if op.Date == nil {
				continue
			}
			opDate := dateOnlyUTC(op.Date.UTC())
			if opDate.After(rangeTill) {
				continue
			}
			if opDate.Before(rangeFrom) {
				rangeFrom = opDate
			}
		}
	}

	if rangeFrom.After(rangeTill) {
		rangeFrom, rangeTill = rangeTill, rangeFrom
	}
	return rangeFrom, rangeTill
}

func buildDateLabels(fromDate, tillDate time.Time) []string {
	fromDate = dateOnlyUTC(fromDate)
	tillDate = dateOnlyUTC(tillDate)
	if fromDate.After(tillDate) {
		fromDate, tillDate = tillDate, fromDate
	}
	totalDays := int(tillDate.Sub(fromDate).Hours()/24) + 1
	if totalDays < 1 {
		totalDays = 1
	}

	result := make([]string, 0, totalDays)
	for day := fromDate; !day.After(tillDate); day = day.AddDate(0, 0, 1) {
		result = append(result, day.Format("2006-01-02"))
	}
	return result
}

func resolveAnalyticsAnchors(
	operations []OperationHistoryItem,
	fromDate *time.Time,
	tillDate *time.Time,
) []string {
	today := time.Now().UTC().Format("2006-01-02")
	maxDate := today
	if tillDate != nil {
		maxDate = tillDate.UTC().Format("2006-01-02")
	}

	minDate := ""
	if fromDate != nil {
		minDate = fromDate.UTC().Format("2006-01-02")
	}

	dates := map[string]struct{}{maxDate: {}}
	if minDate != "" {
		dates[minDate] = struct{}{}
	}
	for _, op := range operations {
		if op.Date == nil {
			continue
		}
		date := op.Date.UTC().Format("2006-01-02")
		if minDate != "" && date < minDate {
			continue
		}
		if maxDate != "" && date > maxDate {
			continue
		}
		dates[date] = struct{}{}
	}

	anchors := make([]string, 0, len(dates))
	for date := range dates {
		anchors = append(anchors, date)
	}
	sort.Strings(anchors)
	return anchors
}

func parseDateRangePointers(from, till string) (*time.Time, *time.Time, error) {
	fromDate, err := parseOptionalDate(from)
	if err != nil {
		return nil, nil, err
	}
	tillDate, err := parseOptionalDate(till)
	if err != nil {
		return nil, nil, err
	}
	if fromDate != nil && tillDate != nil && fromDate.After(*tillDate) {
		fromDate, tillDate = tillDate, fromDate
	}
	return fromDate, tillDate, nil
}

func parseOptionalDate(value string) (*time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return nil, errors.New("invalid date format")
	}
	normalized := time.Date(parsed.UTC().Year(), parsed.UTC().Month(), parsed.UTC().Day(), 0, 0, 0, 0, time.UTC)
	return &normalized, nil
}

func dateOnlyUTC(value time.Time) time.Time {
	value = value.UTC()
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}

func downsampleDateStrings(dates []string, intervalDays int) []string {
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

func targetDateAtOrBefore(dates []string, value time.Time) string {
	if len(dates) == 0 {
		return ""
	}
	target := value.UTC().Format("2006-01-02")
	resolved := ""
	for _, date := range dates {
		if date > target {
			break
		}
		resolved = date
	}
	return resolved
}

func normalizeTickers(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		ticker := strings.ToUpper(strings.TrimSpace(value))
		if ticker == "" {
			continue
		}
		if _, exists := seen[ticker]; exists {
			continue
		}
		seen[ticker] = struct{}{}
		result = append(result, ticker)
	}
	return result
}

func normalizeInstrumentKey(instrumentID, figi, ticker string) string {
	candidates := []string{instrumentID, figi, ticker}
	for _, candidate := range candidates {
		value := strings.TrimSpace(candidate)
		if value != "" {
			return value
		}
	}
	return ""
}

func normalizeTicker(ticker, fallback string) string {
	value := strings.ToUpper(strings.TrimSpace(ticker))
	if value != "" {
		return value
	}
	return strings.ToUpper(strings.TrimSpace(fallback))
}
