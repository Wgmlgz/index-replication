package portfolio

import (
	"context"
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/marketprice"
	"server/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	virtualDefaultOperationLimit = 50
	virtualMaxOperationLimit     = 200
	virtualDateLayout            = "2006-01-02"
	virtualDateTimeLayoutMinute  = "2006-01-02T15:04"
	virtualDateTimeLayoutSecond  = "2006-01-02T15:04:05"
)

type VirtualTransactionsRepository interface {
	Create(txn *models.VirtualPortfolioTransaction) error
	GetByActionID(userID int, profileID int, actionID string) (*models.VirtualPortfolioTransaction, error)
	ListByProfile(userID int, profileID int) ([]models.VirtualPortfolioTransaction, error)
	CountByProfile(userID int, profileID int) (int64, error)
	ListByProfilePaged(userID int, profileID int, offset int, limit int) ([]models.VirtualPortfolioTransaction, error)
}

type VirtualProvider struct {
	repo         VirtualTransactionsRepository
	marketPrices *marketprice.Service
}

func NewVirtualProvider(repo VirtualTransactionsRepository, marketPrices *marketprice.Service) *VirtualProvider {
	return &VirtualProvider{
		repo:         repo,
		marketPrices: marketPrices,
	}
}

func (p *VirtualProvider) Name() string {
	return "virtual"
}

func (p *VirtualProvider) Capabilities(_ context.Context, _ *Profile) dto.PortfolioCapabilities {
	return dto.PortfolioCapabilities{
		Actions: []dto.PortfolioProviderAction{
			{ID: "deposit_cash", Label: "Deposit cash"},
			{ID: "buy", Label: "Buy"},
			{ID: "sell", Label: "Sell"},
		},
	}
}

func (p *VirtualProvider) GetSummary(ctx context.Context, profile *Profile) (*dto.PortfolioSummaryResponse, error) {
	transactions, err := p.repo.ListByProfile(profile.UserID, profile.ID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	today := dateOnlyUTC(now)
	yesterday := today.AddDate(0, 0, -1)

	priceBooks := p.loadVirtualPriceBooks(ctx, transactions, yesterday, today)

	state := buildVirtualState(transactions, nil)
	positions := buildSummaryPositionsFromState(state, today.Format(virtualDateLayout), priceBooks)
	money := buildSummaryMoneyFromState(state)
	total := virtualTotalPortfolio(state, today.Format(virtualDateLayout), priceBooks)
	currency := detectPrimaryCurrency(money, positions)

	todayTotal := virtualTotalPortfolio(buildVirtualState(transactions, endOfDay(now)), today.Format(virtualDateLayout), priceBooks)
	yesterdayTotal := virtualTotalPortfolio(buildVirtualState(transactions, endOfDay(yesterday)), yesterday.Format(virtualDateLayout), priceBooks)
	dailyYield := roundFloat(todayTotal-yesterdayTotal, 2)
	dailyYieldRelative := 0.0
	if yesterdayTotal > 0 {
		dailyYieldRelative = roundFloat((dailyYield/yesterdayTotal)*100, 4)
	}

	return &dto.PortfolioSummaryResponse{
		TotalAmountPortfolio: roundFloat(total, 2),
		TotalAmountCurrency:  currency,
		DailyYield:           dailyYield,
		DailyYieldRelative:   dailyYieldRelative,
		Money:                money,
		Positions:            positions,
	}, nil
}

func (p *VirtualProvider) GetHistory(
	ctx context.Context,
	profile *Profile,
	from string,
	till string,
	intervalDays int,
) ([]dto.PortfolioHistoryPoint, error) {
	transactions, err := p.repo.ListByProfile(profile.UserID, profile.ID)
	if err != nil {
		return nil, err
	}
	if len(transactions) == 0 {
		return []dto.PortfolioHistoryPoint{}, nil
	}

	start, end, err := resolveVirtualDateRange(transactions, from, till)
	if err != nil {
		return nil, err
	}
	if start.After(end) {
		start, end = end, start
	}

	step := 1
	if intervalDays > 1 {
		step = intervalDays
	}

	priceBooks := p.loadVirtualPriceBooks(ctx, transactions, start, end)
	points, _, _, _, err := p.buildSampledTimeline(transactions, start, end, step, priceBooks)
	if err != nil {
		return nil, err
	}
	return points, nil
}

func (p *VirtualProvider) GetComposition(
	ctx context.Context,
	profile *Profile,
	date string,
) ([]dto.PortfolioCompositionEntry, error) {
	transactions, err := p.repo.ListByProfile(profile.UserID, profile.ID)
	if err != nil {
		return nil, err
	}
	if len(transactions) == 0 {
		return []dto.PortfolioCompositionEntry{}, nil
	}

	target := time.Now().UTC()
	if strings.TrimSpace(date) != "" {
		parsed, parseErr := time.Parse(virtualDateLayout, strings.TrimSpace(date))
		if parseErr != nil {
			return nil, parseErr
		}
		target = parsed.UTC()
	}

	state := buildVirtualState(transactions, endOfDay(target))
	priceBooks := p.loadVirtualPriceBooks(ctx, transactions, target, target)
	entries := buildCompositionFromState(state, target.Format(virtualDateLayout), priceBooks)
	return entries, nil
}

func (p *VirtualProvider) GetCompositionSeries(
	ctx context.Context,
	profile *Profile,
	tickers []string,
	topCount int,
	selectionMode string,
	selectionDate string,
	from string,
	till string,
	intervalDays int,
) (map[string][]dto.PortfolioCompositionSeriesPoint, error) {
	transactions, err := p.repo.ListByProfile(profile.UserID, profile.ID)
	if err != nil {
		return nil, err
	}
	if len(transactions) == 0 {
		return map[string][]dto.PortfolioCompositionSeriesPoint{}, nil
	}

	start, end, err := resolveVirtualDateRange(transactions, from, till)
	if err != nil {
		return nil, err
	}
	if start.After(end) {
		start, end = end, start
	}

	step := 1
	if intervalDays > 1 {
		step = intervalDays
	}

	priceBooks := p.loadVirtualPriceBooks(ctx, transactions, start, end)
	_, snapshots, sampleDates, sampleDateSet, err := p.buildSampledTimeline(transactions, start, end, step, priceBooks)
	if err != nil {
		return nil, err
	}
	if len(sampleDates) == 0 {
		return map[string][]dto.PortfolioCompositionSeriesPoint{}, nil
	}

	mode := strings.ToLower(strings.TrimSpace(selectionMode))
	if mode == "" {
		mode = "fixed"
	}

	selectedTickers := normalizeTickers(tickers)
	if len(selectedTickers) == 0 {
		switch mode {
		case "rolling":
			selectedTickers = collectRollingTickers(snapshots, sampleDates, topCount)
		default:
			baseDate := sampleDates[len(sampleDates)-1]
			if trimmed := strings.TrimSpace(selectionDate); trimmed != "" {
				if parsed, parseErr := time.Parse(virtualDateLayout, trimmed); parseErr == nil {
					resolved := findSampleDateAtOrBefore(sampleDateSet, parsed.UTC(), sampleDates)
					if resolved != "" {
						baseDate = resolved
					}
				}
			}
			selectedTickers = topTickersFromSnapshot(snapshots[baseDate], topCount)
		}
	}

	result := make(map[string][]dto.PortfolioCompositionSeriesPoint, len(selectedTickers))
	for _, ticker := range selectedTickers {
		points := make([]dto.PortfolioCompositionSeriesPoint, 0, len(sampleDates))
		for _, sampleDate := range sampleDates {
			points = append(points, dto.PortfolioCompositionSeriesPoint{
				TradeDate: sampleDate,
				Weight:    roundFloat(snapshots[sampleDate][ticker], 4),
			})
		}
		result[ticker] = points
	}
	return result, nil
}

func (p *VirtualProvider) GetOperations(
	_ context.Context,
	profile *Profile,
	cursor string,
	limit int32,
) (*dto.PortfolioOperationsHistoryResponse, error) {
	offset := 0
	if trimmed := strings.TrimSpace(cursor); trimmed != "" {
		parsed, parseErr := strconv.Atoi(trimmed)
		if parseErr == nil && parsed > 0 {
			offset = parsed
		}
	}

	size := int(limit)
	if size <= 0 {
		size = virtualDefaultOperationLimit
	}
	if size > virtualMaxOperationLimit {
		size = virtualMaxOperationLimit
	}

	count, err := p.repo.CountByProfile(profile.UserID, profile.ID)
	if err != nil {
		return nil, err
	}
	if offset > int(count) {
		offset = int(count)
	}

	rows, err := p.repo.ListByProfilePaged(profile.UserID, profile.ID, offset, size)
	if err != nil {
		return nil, err
	}

	items := make([]dto.PortfolioOperationHistoryItem, 0, len(rows))
	for _, row := range rows {
		executedAt := row.ExecutedAt.UTC()
		items = append(items, dto.PortfolioOperationHistoryItem{
			Cursor:             strconv.Itoa(offset + len(items)),
			ID:                 strconv.Itoa(row.ID),
			Date:               &executedAt,
			Type:               virtualOperationItemType(row.OperationType),
			State:              "OPERATION_STATE_EXECUTED",
			Name:               virtualOperationName(row),
			Description:        virtualOperationDescription(row),
			InstrumentID:       row.InstrumentID,
			Figi:               row.InstrumentID,
			InstrumentType:     "share",
			Quantity:           int64(math.Round(row.Quantity)),
			QuantityDone:       int64(math.Round(row.Quantity)),
			QuantityRest:       0,
			Payment:            roundFloat(virtualOperationPayment(row), 2),
			PaymentCurrency:    strings.ToUpper(strings.TrimSpace(row.Currency)),
			Price:              roundFloat(row.Price, 4),
			PriceCurrency:      strings.ToUpper(strings.TrimSpace(row.Currency)),
			Commission:         roundFloat(row.Commission, 2),
			CommissionCurrency: strings.ToUpper(strings.TrimSpace(row.Currency)),
		})
	}

	nextOffset := offset + len(rows)
	hasNext := int64(nextOffset) < count
	nextCursor := ""
	if hasNext {
		nextCursor = strconv.Itoa(nextOffset)
	}

	return &dto.PortfolioOperationsHistoryResponse{
		HasNext:    hasNext,
		NextCursor: nextCursor,
		Items:      items,
	}, nil
}

func (p *VirtualProvider) RunAction(
	_ context.Context,
	profile *Profile,
	action string,
	payload map[string]interface{},
) (map[string]interface{}, error) {
	normalizedAction := strings.ToLower(strings.TrimSpace(action))
	if normalizedAction == "" {
		return nil, ErrInvalidAction
	}

	if payload == nil {
		payload = map[string]interface{}{}
	}
	actionID, err := parseVirtualActionIDPayload(payload)
	if err != nil {
		return nil, ErrInvalidRequest
	}

	existingTxn, err := p.repo.GetByActionID(profile.UserID, profile.ID, actionID)
	if err == nil {
		if existingTxn.OperationType != normalizedAction {
			return nil, ErrInvalidRequest
		}
		return virtualTxnActionResult(existingTxn, true), nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	transactions, err := p.repo.ListByProfile(profile.UserID, profile.ID)
	if err != nil {
		return nil, err
	}
	state := buildVirtualState(transactions, nil)

	executedAt, err := parseExecutedAtPayload(payload)
	if err != nil {
		return nil, ErrInvalidRequest
	}

	switch normalizedAction {
	case "deposit_cash":
		currency := normalizeCurrency(stringValue(payload["currency"]))
		amount, ok := float64Payload(payload["amount"])
		if !ok || math.Abs(amount) <= 1e-9 {
			return nil, ErrInvalidRequest
		}
		txn := &models.VirtualPortfolioTransaction{
			UserID:             profile.UserID,
			PortfolioProfileID: profile.ID,
			ActionID:           &actionID,
			OperationType:      normalizedAction,
			Amount:             roundFloat(amount, 2),
			Currency:           currency,
			ExecutedAt:         executedAt,
		}
		if err := p.repo.Create(txn); err != nil {
			if isVirtualActionIDConflict(err) {
				conflictTxn, loadErr := p.repo.GetByActionID(profile.UserID, profile.ID, actionID)
				if loadErr == nil {
					return virtualTxnActionResult(conflictTxn, true), nil
				}
			}
			return nil, err
		}
		return virtualTxnActionResult(txn, false), nil

	case "buy":
		ticker := rawStringValue(payload["ticker"])
		instrumentID := rawStringValue(payload["instrument_id"])
		if ticker == "" && instrumentID == "" {
			return nil, ErrInvalidRequest
		}
		if instrumentID == "" {
			instrumentID = ticker
		}
		if ticker == "" {
			ticker = instrumentID
		}

		quantity, ok := float64Payload(payload["quantity"])
		if !ok || quantity <= 0 {
			return nil, ErrInvalidRequest
		}
		price, ok := float64Payload(payload["price"])
		if !ok || price <= 0 {
			return nil, ErrInvalidRequest
		}

		currency := normalizeCurrency(stringValue(payload["currency"]))
		amount, amountProvided := float64Payload(payload["amount"])
		if !amountProvided || amount <= 0 {
			amount = quantity * price
		}
		commission, _ := float64Payload(payload["commission"])
		if commission < 0 {
			return nil, ErrInvalidRequest
		}

		requiredCash := amount + commission
		availableCash := state.Cash[currency]
		if availableCash+1e-9 < requiredCash {
			return nil, ErrInvalidRequest
		}

		txn := &models.VirtualPortfolioTransaction{
			UserID:             profile.UserID,
			PortfolioProfileID: profile.ID,
			ActionID:           &actionID,
			OperationType:      normalizedAction,
			Ticker:             ticker,
			InstrumentID:       instrumentID,
			Quantity:           roundFloat(quantity, 8),
			Price:              roundFloat(price, 8),
			Amount:             roundFloat(amount, 2),
			Currency:           currency,
			Commission:         roundFloat(commission, 2),
			ExecutedAt:         executedAt,
		}
		if err := p.repo.Create(txn); err != nil {
			if isVirtualActionIDConflict(err) {
				conflictTxn, loadErr := p.repo.GetByActionID(profile.UserID, profile.ID, actionID)
				if loadErr == nil {
					return virtualTxnActionResult(conflictTxn, true), nil
				}
			}
			return nil, err
		}
		result := virtualTxnActionResult(txn, false)
		result["cash_before"] = roundFloat(availableCash, 2)
		result["cash_required"] = roundFloat(requiredCash, 2)
		result["cash_after_estimate"] = roundFloat(availableCash-requiredCash, 2)
		return result, nil

	case "sell":
		ticker := rawStringValue(payload["ticker"])
		instrumentID := rawStringValue(payload["instrument_id"])
		if ticker == "" && instrumentID == "" {
			return nil, ErrInvalidRequest
		}

		quantity, ok := float64Payload(payload["quantity"])
		if !ok || quantity <= 0 {
			return nil, ErrInvalidRequest
		}
		price, ok := float64Payload(payload["price"])
		if !ok || price <= 0 {
			return nil, ErrInvalidRequest
		}

		currency := normalizeCurrency(stringValue(payload["currency"]))
		amount, amountProvided := float64Payload(payload["amount"])
		if !amountProvided || amount <= 0 {
			amount = quantity * price
		}
		commission, _ := float64Payload(payload["commission"])
		if commission < 0 {
			return nil, ErrInvalidRequest
		}

		positionKey, position := findVirtualPosition(state, ticker, instrumentID)
		if position == nil || position.Quantity+1e-9 < quantity {
			return nil, ErrInvalidRequest
		}
		if instrumentID == "" {
			instrumentID = position.InstrumentID
		}
		if ticker == "" {
			ticker = position.Ticker
		}
		if instrumentID == "" {
			instrumentID = positionKey
		}
		if ticker == "" {
			ticker = positionKey
		}

		txn := &models.VirtualPortfolioTransaction{
			UserID:             profile.UserID,
			PortfolioProfileID: profile.ID,
			ActionID:           &actionID,
			OperationType:      normalizedAction,
			Ticker:             ticker,
			InstrumentID:       instrumentID,
			Quantity:           roundFloat(quantity, 8),
			Price:              roundFloat(price, 8),
			Amount:             roundFloat(amount, 2),
			Currency:           currency,
			Commission:         roundFloat(commission, 2),
			ExecutedAt:         executedAt,
		}
		if err := p.repo.Create(txn); err != nil {
			if isVirtualActionIDConflict(err) {
				conflictTxn, loadErr := p.repo.GetByActionID(profile.UserID, profile.ID, actionID)
				if loadErr == nil {
					return virtualTxnActionResult(conflictTxn, true), nil
				}
			}
			return nil, err
		}
		result := virtualTxnActionResult(txn, false)
		result["position_before"] = roundFloat(position.Quantity, 8)
		result["position_after_estimate"] = roundFloat(position.Quantity-quantity, 8)
		return result, nil

	default:
		return nil, ErrInvalidAction
	}
}

func (p *VirtualProvider) buildSampledTimeline(
	transactions []models.VirtualPortfolioTransaction,
	start time.Time,
	end time.Time,
	intervalDays int,
	priceBooks map[string]map[string]float64,
) (
	[]dto.PortfolioHistoryPoint,
	map[string]map[string]float64,
	[]string,
	map[string]struct{},
	error,
) {
	if intervalDays < 1 {
		intervalDays = 1
	}

	state := newVirtualState()
	points := make([]dto.PortfolioHistoryPoint, 0, 128)
	snapshots := make(map[string]map[string]float64, 128)
	sampleDates := make([]string, 0, 128)
	sampleDateSet := make(map[string]struct{}, 128)

	txIndex := 0
	sampledCount := 0
	for day := dateOnlyUTC(start); !day.After(dateOnlyUTC(end)); day = day.AddDate(0, 0, 1) {
		dayEnd := endOfDay(day)
		for txIndex < len(transactions) {
			txnTime := transactions[txIndex].ExecutedAt.UTC()
			if txnTime.After(*dayEnd) {
				break
			}
			applyVirtualTransaction(state, &transactions[txIndex])
			txIndex++
		}

		shouldSample := sampledCount%intervalDays == 0 || sameDate(day, end)
		if !shouldSample {
			sampledCount++
			continue
		}

		tradeDate := day.Format(virtualDateLayout)
		positions := buildSummaryPositionsFromState(state, tradeDate, priceBooks)
		points = append(points, dto.PortfolioHistoryPoint{
			TradeDate:            tradeDate,
			TotalAmountPortfolio: roundFloat(virtualTotalPortfolio(state, tradeDate, priceBooks), 2),
			Currency:             detectPrimaryCurrency(buildSummaryMoneyFromState(state), positions),
		})

		snapshots[tradeDate] = buildTickerWeightSnapshot(state, tradeDate, priceBooks)
		sampleDates = append(sampleDates, tradeDate)
		sampleDateSet[tradeDate] = struct{}{}
		sampledCount++
	}

	if len(points) == 0 {
		tradeDate := dateOnlyUTC(end).Format(virtualDateLayout)
		positions := buildSummaryPositionsFromState(state, tradeDate, priceBooks)
		points = append(points, dto.PortfolioHistoryPoint{
			TradeDate:            tradeDate,
			TotalAmountPortfolio: roundFloat(virtualTotalPortfolio(state, tradeDate, priceBooks), 2),
			Currency:             detectPrimaryCurrency(buildSummaryMoneyFromState(state), positions),
		})
		snapshots[tradeDate] = buildTickerWeightSnapshot(state, tradeDate, priceBooks)
		sampleDates = append(sampleDates, tradeDate)
		sampleDateSet[tradeDate] = struct{}{}
	}

	return points, snapshots, sampleDates, sampleDateSet, nil
}

type virtualPosition struct {
	Ticker       string
	InstrumentID string
	Name         string
	Quantity     float64
	AvgCost      float64
	LastPrice    float64
	Currency     string
}

type virtualState struct {
	Cash      map[string]float64
	Positions map[string]*virtualPosition
}

func newVirtualState() *virtualState {
	return &virtualState{
		Cash:      make(map[string]float64),
		Positions: make(map[string]*virtualPosition),
	}
}

func buildVirtualState(transactions []models.VirtualPortfolioTransaction, cutoff *time.Time) *virtualState {
	state := newVirtualState()
	for idx := range transactions {
		txn := transactions[idx]
		if cutoff != nil && txn.ExecutedAt.UTC().After(cutoff.UTC()) {
			break
		}
		applyVirtualTransaction(state, &txn)
	}
	return state
}

func applyVirtualTransaction(state *virtualState, txn *models.VirtualPortfolioTransaction) {
	if state == nil || txn == nil {
		return
	}

	operation := strings.ToLower(strings.TrimSpace(txn.OperationType))
	currency := normalizeCurrency(txn.Currency)
	amount := txn.Amount
	quantity := txn.Quantity
	price := txn.Price
	commission := txn.Commission
	key := virtualPositionKey(txn.Ticker, txn.InstrumentID)

	switch operation {
	case "deposit_cash":
		state.Cash[currency] += amount
	case "buy":
		state.Cash[currency] -= amount + commission
		if key == "" {
			return
		}
		position, exists := state.Positions[key]
		if !exists {
			position = &virtualPosition{
				Ticker:       txn.Ticker,
				InstrumentID: txn.InstrumentID,
				Name:         resolveVirtualPositionName(txn.Ticker, txn.InstrumentID),
				Currency:     currency,
			}
			state.Positions[key] = position
		}
		newQuantity := position.Quantity + quantity
		if newQuantity > 0 {
			totalCost := position.AvgCost*position.Quantity + amount + commission
			position.AvgCost = totalCost / newQuantity
		}
		position.Quantity = newQuantity
		if price > 0 {
			position.LastPrice = price
		}
		if position.Currency == "" {
			position.Currency = currency
		}
		if position.Ticker == "" {
			position.Ticker = txn.Ticker
		}
		if position.InstrumentID == "" {
			position.InstrumentID = txn.InstrumentID
		}
		if position.Name == "" {
			position.Name = resolveVirtualPositionName(position.Ticker, position.InstrumentID)
		}
	case "sell":
		state.Cash[currency] += amount - commission
		if key == "" {
			return
		}
		position, exists := state.Positions[key]
		if !exists {
			return
		}
		position.Quantity -= quantity
		if price > 0 {
			position.LastPrice = price
		}
		if position.Quantity <= 1e-9 {
			delete(state.Positions, key)
		}
	}
}

func buildSummaryMoneyFromState(state *virtualState) []dto.PortfolioSummaryMoneyBalance {
	if state == nil || len(state.Cash) == 0 {
		return []dto.PortfolioSummaryMoneyBalance{}
	}
	currencies := make([]string, 0, len(state.Cash))
	for currency, amount := range state.Cash {
		if math.Abs(amount) <= 1e-9 {
			continue
		}
		currencies = append(currencies, currency)
	}
	sort.Strings(currencies)
	balances := make([]dto.PortfolioSummaryMoneyBalance, 0, len(currencies))
	for _, currency := range currencies {
		amount := roundFloat(state.Cash[currency], 2)
		balances = append(balances, dto.PortfolioSummaryMoneyBalance{
			Currency:          currency,
			Available:         amount,
			Blocked:           0,
			WithdrawAvailable: amount,
			WithdrawBlocked:   0,
		})
	}
	return balances
}

func buildSummaryPositionsFromState(
	state *virtualState,
	tradeDate string,
	priceBooks map[string]map[string]float64,
) []dto.PortfolioSummaryPosition {
	if state == nil || len(state.Positions) == 0 {
		return []dto.PortfolioSummaryPosition{}
	}
	positions := make([]dto.PortfolioSummaryPosition, 0, len(state.Positions))
	for key, position := range state.Positions {
		if position.Quantity <= 1e-9 {
			continue
		}
		lastPrice := resolveVirtualPositionPrice(key, position, tradeDate, priceBooks)
		currentValue := position.Quantity * lastPrice
		expectedYield := (lastPrice - position.AvgCost) * position.Quantity
		positions = append(positions, dto.PortfolioSummaryPosition{
			Ticker:         position.Ticker,
			InstrumentID:   position.InstrumentID,
			Name:           position.Name,
			InstrumentType: "share",
			Quantity:       roundFloat(position.Quantity, 8),
			CurrentPrice:   roundFloat(lastPrice, 4),
			CurrentValue:   roundFloat(currentValue, 2),
			ExpectedYield:  roundFloat(expectedYield, 2),
			Currency:       normalizeCurrency(position.Currency),
		})
	}
	sort.Slice(positions, func(i, j int) bool {
		if positions[i].CurrentValue == positions[j].CurrentValue {
			return positions[i].Ticker < positions[j].Ticker
		}
		return positions[i].CurrentValue > positions[j].CurrentValue
	})
	return positions
}

func buildCompositionFromState(
	state *virtualState,
	tradeDate string,
	priceBooks map[string]map[string]float64,
) []dto.PortfolioCompositionEntry {
	positions := buildSummaryPositionsFromState(state, tradeDate, priceBooks)
	if len(positions) == 0 {
		return []dto.PortfolioCompositionEntry{}
	}
	totalPositionsValue := 0.0
	for _, position := range positions {
		totalPositionsValue += position.CurrentValue
	}
	result := make([]dto.PortfolioCompositionEntry, 0, len(positions))
	for _, position := range positions {
		weight := 0.0
		if totalPositionsValue > 0 {
			weight = position.CurrentValue / totalPositionsValue * 100
		}
		result = append(result, dto.PortfolioCompositionEntry{
			TradeDate:    tradeDate,
			Ticker:       position.Ticker,
			InstrumentID: position.InstrumentID,
			Name:         position.Name,
			Quantity:     position.Quantity,
			CurrentPrice: position.CurrentPrice,
			CurrentValue: position.CurrentValue,
			Currency:     position.Currency,
			Weight:       roundFloat(weight, 4),
		})
	}
	return result
}

func buildTickerWeightSnapshot(
	state *virtualState,
	tradeDate string,
	priceBooks map[string]map[string]float64,
) map[string]float64 {
	entries := buildCompositionFromState(state, tradeDate, priceBooks)
	snapshot := make(map[string]float64, len(entries))
	for _, entry := range entries {
		ticker := entry.Ticker
		if ticker == "" {
			ticker = entry.InstrumentID
		}
		if ticker == "" {
			continue
		}
		snapshot[ticker] = roundFloat(entry.Weight, 4)
	}
	return snapshot
}

func collectRollingTickers(snapshots map[string]map[string]float64, dates []string, topCount int) []string {
	if len(dates) == 0 {
		return []string{}
	}
	seen := make(map[string]struct{})
	selected := make([]string, 0)
	for _, date := range dates {
		current := snapshots[date]
		tickers := topTickersFromSnapshot(current, topCount)
		for _, ticker := range tickers {
			if _, exists := seen[ticker]; exists {
				continue
			}
			seen[ticker] = struct{}{}
			selected = append(selected, ticker)
		}
	}
	return selected
}

func topTickersFromSnapshot(snapshot map[string]float64, topCount int) []string {
	if len(snapshot) == 0 {
		return []string{}
	}
	type row struct {
		Ticker string
		Weight float64
	}
	rows := make([]row, 0, len(snapshot))
	for ticker, weight := range snapshot {
		rows = append(rows, row{Ticker: ticker, Weight: weight})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Weight == rows[j].Weight {
			return rows[i].Ticker < rows[j].Ticker
		}
		return rows[i].Weight > rows[j].Weight
	})
	limit := len(rows)
	if topCount > 0 && topCount < limit {
		limit = topCount
	}
	result := make([]string, 0, limit)
	for _, row := range rows[:limit] {
		result = append(result, row.Ticker)
	}
	return result
}

func findSampleDateAtOrBefore(sampleDateSet map[string]struct{}, target time.Time, ordered []string) string {
	if len(ordered) == 0 {
		return ""
	}
	current := dateOnlyUTC(target)
	oldest, parseErr := time.Parse(virtualDateLayout, ordered[0])
	if parseErr != nil {
		return ""
	}
	for !current.Before(oldest) {
		dateString := current.Format(virtualDateLayout)
		if _, exists := sampleDateSet[dateString]; exists {
			return dateString
		}
		current = current.AddDate(0, 0, -1)
	}
	return ""
}

func resolveVirtualDateRange(
	transactions []models.VirtualPortfolioTransaction,
	from string,
	till string,
) (time.Time, time.Time, error) {
	now := dateOnlyUTC(time.Now().UTC())
	start := now
	end := now
	if len(transactions) > 0 {
		start = dateOnlyUTC(transactions[0].ExecutedAt.UTC())
	}

	if trimmed := strings.TrimSpace(from); trimmed != "" {
		parsed, err := time.Parse(virtualDateLayout, trimmed)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		start = dateOnlyUTC(parsed.UTC())
	}
	if trimmed := strings.TrimSpace(till); trimmed != "" {
		parsed, err := time.Parse(virtualDateLayout, trimmed)
		if err != nil {
			return time.Time{}, time.Time{}, err
		}
		end = dateOnlyUTC(parsed.UTC())
	} else if len(transactions) > 0 {
		end = now
	}
	return start, end, nil
}

func dateOnlyUTC(value time.Time) time.Time {
	value = value.UTC()
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
}

func endOfDay(value time.Time) *time.Time {
	day := dateOnlyUTC(value)
	end := day.Add(24*time.Hour - time.Nanosecond)
	return &end
}

func sameDate(left, right time.Time) bool {
	l := dateOnlyUTC(left)
	r := dateOnlyUTC(right)
	return l.Equal(r)
}

func float64Payload(value interface{}) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func normalizeCurrency(value string) string {
	currency := strings.ToUpper(strings.TrimSpace(value))
	if currency == "" {
		return "RUB"
	}
	return currency
}

func parseExecutedAtPayload(payload map[string]interface{}) (time.Time, error) {
	if payload == nil {
		return time.Now().UTC(), nil
	}

	// Keep backward compatibility with "executed_at" and allow a simpler "date" alias.
	if hasPayloadTimeValue(payload, "executed_at") {
		return parseExecutedAt(payload["executed_at"])
	}
	if hasPayloadTimeValue(payload, "date") {
		return parseExecutedAt(payload["date"])
	}
	return time.Now().UTC(), nil
}

func parseExecutedAt(value interface{}) (time.Time, error) {
	if value == nil {
		return time.Now().UTC(), nil
	}
	raw := strings.TrimSpace(stringValue(value))
	if raw == "" {
		return time.Now().UTC(), nil
	}
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed.UTC(), nil
	}
	if parsed, err := time.ParseInLocation(virtualDateTimeLayoutSecond, raw, time.Local); err == nil {
		return parsed.UTC(), nil
	}
	if parsed, err := time.ParseInLocation(virtualDateTimeLayoutMinute, raw, time.Local); err == nil {
		return parsed.UTC(), nil
	}
	if parsed, err := time.Parse(virtualDateLayout, raw); err == nil {
		return parsed.UTC(), nil
	}
	return time.Time{}, ErrInvalidRequest
}

func hasPayloadTimeValue(payload map[string]interface{}, key string) bool {
	raw, ok := payload[key]
	if !ok || raw == nil {
		return false
	}
	return strings.TrimSpace(stringValue(raw)) != ""
}

func parseVirtualActionIDPayload(payload map[string]interface{}) (string, error) {
	if payload == nil {
		return "", ErrInvalidRequest
	}
	rawActionID, ok := payload["action_id"]
	if !ok {
		return "", ErrInvalidRequest
	}
	actionID := strings.TrimSpace(stringValue(rawActionID))
	if actionID == "" {
		return "", ErrInvalidRequest
	}
	if _, err := uuid.Parse(actionID); err != nil {
		return "", ErrInvalidRequest
	}
	return actionID, nil
}

func isVirtualActionIDConflict(err error) bool {
	if err == nil {
		return false
	}
	value := strings.ToLower(strings.TrimSpace(err.Error()))
	if strings.Contains(value, "idx_virtual_portfolio_transactions_action_id") {
		return true
	}
	if strings.Contains(value, "unique constraint failed") && strings.Contains(value, "virtual_portfolio_transactions") && strings.Contains(value, "action_id") {
		return true
	}
	if strings.Contains(value, "duplicate key value violates unique constraint") && strings.Contains(value, "idx_virtual_portfolio_transactions_action_id") {
		return true
	}
	return false
}

func virtualTxnActionResult(txn *models.VirtualPortfolioTransaction, idempotent bool) map[string]interface{} {
	if txn == nil {
		return map[string]interface{}{
			"status": "ok",
		}
	}
	result := map[string]interface{}{
		"status":        "ok",
		"operation_id":  txn.ID,
		"action_id":     strings.TrimSpace(stringPtrValue(txn.ActionID)),
		"idempotent":    idempotent,
		"ticker":        txn.Ticker,
		"instrument_id": txn.InstrumentID,
		"quantity":      txn.Quantity,
		"price":         txn.Price,
		"amount":        txn.Amount,
		"commission":    txn.Commission,
		"currency":      normalizeCurrency(txn.Currency),
		"executed_at":   txn.ExecutedAt.UTC().Format(time.RFC3339),
	}
	return result
}

func stringPtrValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func rawStringValue(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func virtualPositionKey(ticker string, instrumentID string) string {
	if instrumentID != "" {
		return instrumentID
	}
	return ticker
}

func resolveVirtualPositionName(ticker string, instrumentID string) string {
	if ticker != "" {
		return ticker
	}
	if instrumentID != "" {
		return instrumentID
	}
	return "Instrument"
}

func findVirtualPosition(state *virtualState, ticker string, instrumentID string) (string, *virtualPosition) {
	if state == nil {
		return "", nil
	}
	if instrumentID != "" {
		if position, exists := state.Positions[instrumentID]; exists {
			return instrumentID, position
		}
	}
	if ticker != "" {
		if position, exists := state.Positions[ticker]; exists {
			return ticker, position
		}
	}
	for key, position := range state.Positions {
		if instrumentID != "" && strings.EqualFold(position.InstrumentID, instrumentID) {
			return key, position
		}
		if ticker != "" && strings.EqualFold(position.Ticker, ticker) {
			return key, position
		}
	}
	return "", nil
}

func virtualTotalPortfolio(
	state *virtualState,
	tradeDate string,
	priceBooks map[string]map[string]float64,
) float64 {
	if state == nil {
		return 0
	}
	total := 0.0
	for _, amount := range state.Cash {
		total += amount
	}
	for key, position := range state.Positions {
		if position.Quantity <= 1e-9 {
			continue
		}
		price := resolveVirtualPositionPrice(key, position, tradeDate, priceBooks)
		total += position.Quantity * price
	}
	return total
}

func resolveVirtualPositionPrice(
	key string,
	position *virtualPosition,
	tradeDate string,
	priceBooks map[string]map[string]float64,
) float64 {
	if position == nil {
		return 0
	}
	if tradeDate != "" && priceBooks != nil {
		if byDate, exists := priceBooks[key]; exists {
			if value, ok := byDate[tradeDate]; ok && value > 0 {
				return value
			}
		}
	}
	if position.LastPrice > 0 {
		return position.LastPrice
	}
	if position.AvgCost > 0 {
		return position.AvgCost
	}
	return 0
}

func (p *VirtualProvider) loadVirtualPriceBooks(
	ctx context.Context,
	transactions []models.VirtualPortfolioTransaction,
	fromDate time.Time,
	toDate time.Time,
) map[string]map[string]float64 {
	if p.marketPrices == nil || len(transactions) == 0 {
		return map[string]map[string]float64{}
	}
	if fromDate.After(toDate) {
		fromDate, toDate = toDate, fromDate
	}

	type instrumentRef struct {
		Key    string
		Ticker string
	}
	refs := make(map[string]instrumentRef)
	for _, txn := range transactions {
		op := strings.ToLower(strings.TrimSpace(txn.OperationType))
		if op != "buy" && op != "sell" {
			continue
		}
		key := virtualPositionKey(txn.Ticker, txn.InstrumentID)
		if key == "" {
			continue
		}
		ticker := txn.Ticker
		existing, hasExisting := refs[key]
		if !hasExisting {
			refs[key] = instrumentRef{
				Key:    key,
				Ticker: ticker,
			}
			continue
		}
		if existing.Ticker == "" && ticker != "" {
			existing.Ticker = ticker
			refs[key] = existing
		}
	}

	priceBooks := make(map[string]map[string]float64, len(refs))
	for _, ref := range refs {
		series, err := p.marketPrices.GetDailyAsOfPrices(ctx, marketprice.InstrumentRangeRequest{
			Provider:      "virtual",
			InstrumentKey: ref.Key,
			Ticker:        ref.Ticker,
			From:          fromDate,
			To:            toDate,
		})
		if err != nil || series == nil || len(series.Prices) == 0 {
			continue
		}
		priceBooks[ref.Key] = series.Prices
	}
	return priceBooks
}

func detectPrimaryCurrency(
	money []dto.PortfolioSummaryMoneyBalance,
	positions []dto.PortfolioSummaryPosition,
) string {
	currencies := make(map[string]int)
	for _, row := range money {
		currency := normalizeCurrency(row.Currency)
		if currency != "" {
			currencies[currency]++
		}
	}
	for _, row := range positions {
		currency := normalizeCurrency(row.Currency)
		if currency != "" {
			currencies[currency]++
		}
	}
	if len(currencies) == 0 {
		return "RUB"
	}
	if len(currencies) == 1 {
		for currency := range currencies {
			return currency
		}
	}
	bestCurrency := ""
	bestCount := -1
	for currency, count := range currencies {
		if count > bestCount || (count == bestCount && (bestCurrency == "" || currency < bestCurrency)) {
			bestCurrency = currency
			bestCount = count
		}
	}
	return bestCurrency
}

func virtualOperationItemType(operationType string) string {
	switch strings.ToLower(strings.TrimSpace(operationType)) {
	case "buy":
		return "OPERATION_TYPE_BUY"
	case "sell":
		return "OPERATION_TYPE_SELL"
	case "deposit_cash":
		return "OPERATION_TYPE_INPUT"
	default:
		return "OPERATION_TYPE_UNSPECIFIED"
	}
}

func virtualOperationName(row models.VirtualPortfolioTransaction) string {
	switch strings.ToLower(strings.TrimSpace(row.OperationType)) {
	case "deposit_cash":
		return "Cash deposit"
	default:
		if ticker := row.Ticker; ticker != "" {
			return ticker
		}
		if instrumentID := row.InstrumentID; instrumentID != "" {
			return instrumentID
		}
		return "Virtual trade"
	}
}

func virtualOperationDescription(row models.VirtualPortfolioTransaction) string {
	switch strings.ToLower(strings.TrimSpace(row.OperationType)) {
	case "deposit_cash":
		return "Virtual cash deposit"
	case "buy":
		return "Virtual buy order"
	case "sell":
		return "Virtual sell order"
	default:
		return "Virtual operation"
	}
}

func virtualOperationPayment(row models.VirtualPortfolioTransaction) float64 {
	switch strings.ToLower(strings.TrimSpace(row.OperationType)) {
	case "buy":
		return -(row.Amount + row.Commission)
	case "sell":
		return row.Amount - row.Commission
	case "deposit_cash":
		return row.Amount
	default:
		return row.Amount
	}
}
