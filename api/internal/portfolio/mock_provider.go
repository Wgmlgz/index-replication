package portfolio

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"server/internal/api/dto"
)

const (
	mockDefaultOperationLimit = 50
	mockMaxOperationLimit     = 200
)

var mockTickers = []string{"MOCKA", "MOCKB", "MOCKC", "MOCKD", "MOCKE", "MOCKF", "MOCKG"}

type MockProvider struct{}

func NewMockProvider() *MockProvider {
	return &MockProvider{}
}

func (p *MockProvider) Name() string {
	return "mock"
}

func (p *MockProvider) Capabilities(_ context.Context, _ *Profile) dto.PortfolioCapabilities {
	return dto.PortfolioCapabilities{
		Actions: []dto.PortfolioProviderAction{
			{
				ID:    "refresh",
				Label: "Refresh mock data",
			},
		},
	}
}

func (p *MockProvider) GetSummary(_ context.Context, profile *Profile) (*dto.PortfolioSummaryResponse, error) {
	asOf := time.Now().UTC()
	positions := mockPositions(profile, asOf)
	total := 0.0
	for _, position := range positions {
		total += position.CurrentValue
	}
	cash := math.Max(0, total*0.17)

	return &dto.PortfolioSummaryResponse{
		TotalAmountPortfolio: total + cash,
		TotalAmountCurrency:  "RUB",
		DailyYield:           roundFloat((total+cash)*0.006, 2),
		DailyYieldRelative:   0.6,
		Money: []dto.PortfolioSummaryMoneyBalance{
			{
				Currency:          "RUB",
				Available:         roundFloat(cash*0.8, 2),
				Blocked:           roundFloat(cash*0.2, 2),
				WithdrawAvailable: roundFloat(cash*0.75, 2),
				WithdrawBlocked:   roundFloat(cash*0.05, 2),
			},
		},
		Positions: positions,
	}, nil
}

func (p *MockProvider) GetHistory(
	_ context.Context,
	profile *Profile,
	from string,
	till string,
	intervalDays int,
) ([]dto.PortfolioHistoryPoint, error) {
	dates := resolveDates(from, till, intervalDays)
	points := make([]dto.PortfolioHistoryPoint, 0, len(dates))
	for i, date := range dates {
		base := mockBaseValue(profile, date)
		noise := 1 + (math.Sin(float64(i+profile.ID)) * 0.02)
		points = append(points, dto.PortfolioHistoryPoint{
			TradeDate:            date.Format("2006-01-02"),
			TotalAmountPortfolio: roundFloat(base*noise, 2),
			Currency:             "RUB",
		})
	}
	return points, nil
}

func (p *MockProvider) GetComposition(
	_ context.Context,
	profile *Profile,
	date string,
) ([]dto.PortfolioCompositionEntry, error) {
	target := time.Now().UTC()
	if trimmed := strings.TrimSpace(date); trimmed != "" {
		parsed, err := time.Parse("2006-01-02", trimmed)
		if err != nil {
			return nil, err
		}
		target = parsed
	}
	return mockComposition(profile, target), nil
}

func (p *MockProvider) GetCompositionSeries(
	_ context.Context,
	profile *Profile,
	tickers []string,
	topCount int,
	selectionMode string,
	selectionDate string,
	from string,
	till string,
	intervalDays int,
) (map[string][]dto.PortfolioCompositionSeriesPoint, error) {
	dates := resolveDates(from, till, intervalDays)
	normalizedTickers := normalizeTickers(tickers)
	if len(normalizedTickers) == 0 {
		baseDate := time.Now().UTC()
		if strings.TrimSpace(selectionDate) != "" {
			if parsed, err := time.Parse("2006-01-02", strings.TrimSpace(selectionDate)); err == nil {
				baseDate = parsed
			}
		}
		items := mockComposition(profile, baseDate)
		limit := len(items)
		if topCount > 0 && topCount < limit {
			limit = topCount
		}
		if selectionMode == "rolling" && topCount > 0 && topCount < len(mockTickers) {
			normalizedTickers = append(normalizedTickers, mockTickers[:topCount]...)
		} else {
			for _, item := range items[:limit] {
				normalizedTickers = append(normalizedTickers, item.Ticker)
			}
		}
	}

	result := make(map[string][]dto.PortfolioCompositionSeriesPoint, len(normalizedTickers))
	for _, ticker := range normalizedTickers {
		points := make([]dto.PortfolioCompositionSeriesPoint, 0, len(dates))
		for idx, date := range dates {
			weight := mockTickerWeight(profile, ticker, date, idx)
			points = append(points, dto.PortfolioCompositionSeriesPoint{
				TradeDate: date.Format("2006-01-02"),
				Weight:    roundFloat(weight, 4),
			})
		}
		result[ticker] = points
	}
	return result, nil
}

func (p *MockProvider) GetOperations(
	_ context.Context,
	profile *Profile,
	cursor string,
	limit int32,
) (*dto.PortfolioOperationsHistoryResponse, error) {
	offset := 0
	if trimmed := strings.TrimSpace(cursor); trimmed != "" {
		parsed, err := strconv.Atoi(trimmed)
		if err == nil && parsed > 0 {
			offset = parsed
		}
	}

	size := int(limit)
	if size <= 0 {
		size = mockDefaultOperationLimit
	}
	if size > mockMaxOperationLimit {
		size = mockMaxOperationLimit
	}

	all := mockOperations(profile)
	if offset > len(all) {
		offset = len(all)
	}

	end := offset + size
	if end > len(all) {
		end = len(all)
	}
	items := all[offset:end]

	nextCursor := ""
	hasNext := end < len(all)
	if hasNext {
		nextCursor = strconv.Itoa(end)
	}

	return &dto.PortfolioOperationsHistoryResponse{
		HasNext:    hasNext,
		NextCursor: nextCursor,
		Items:      items,
	}, nil
}

func (p *MockProvider) RunAction(_ context.Context, profile *Profile, action string, payload map[string]interface{}) (map[string]interface{}, error) {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "refresh":
		note := ""
		if payload != nil {
			note = stringValue(payload["note"])
		}
		return map[string]interface{}{
			"status":       "ok",
			"profile_id":   profile.ID,
			"profile_name": profile.Name,
			"note":         note,
		}, nil
	default:
		return nil, ErrInvalidAction
	}
}

func mockBaseValue(profile *Profile, at time.Time) float64 {
	daySeed := float64(at.UTC().YearDay())
	return float64(100_000+profile.ID*11_000) + daySeed*87
}

func mockPositions(profile *Profile, at time.Time) []dto.PortfolioSummaryPosition {
	composition := mockComposition(profile, at)
	total := mockBaseValue(profile, at)
	positions := make([]dto.PortfolioSummaryPosition, 0, len(composition))
	for _, item := range composition {
		currentValue := total * item.Weight / 100
		qty := math.Max(1, math.Round((15+float64(profile.ID))*item.Weight/5))
		price := currentValue / qty
		positions = append(positions, dto.PortfolioSummaryPosition{
			Ticker:         item.Ticker,
			InstrumentID:   item.InstrumentID,
			Name:           item.Name,
			InstrumentType: "share",
			Quantity:       qty,
			CurrentPrice:   roundFloat(price, 2),
			CurrentValue:   roundFloat(currentValue, 2),
			ExpectedYield:  roundFloat(currentValue*0.03, 2),
			Currency:       "RUB",
		})
	}
	return positions
}

func mockComposition(profile *Profile, at time.Time) []dto.PortfolioCompositionEntry {
	weights := mockWeights(profile, at)
	total := mockBaseValue(profile, at)
	result := make([]dto.PortfolioCompositionEntry, 0, len(weights))
	for idx, weight := range weights {
		ticker := mockTickers[idx]
		value := total * weight / 100
		quantity := math.Max(1, math.Round((10+float64(idx))*weight/4))
		price := value / quantity
		result = append(result, dto.PortfolioCompositionEntry{
			TradeDate:    at.UTC().Format("2006-01-02"),
			Ticker:       ticker,
			InstrumentID: fmt.Sprintf("MOCK-%d-%d", profile.ID, idx+1),
			Name:         fmt.Sprintf("Mock Asset %d", idx+1),
			Quantity:     quantity,
			CurrentPrice: roundFloat(price, 2),
			CurrentValue: roundFloat(value, 2),
			Currency:     "RUB",
			Weight:       roundFloat(weight, 4),
		})
	}
	return result
}

func mockWeights(profile *Profile, at time.Time) []float64 {
	raw := make([]float64, len(mockTickers))
	sum := 0.0
	for idx := range mockTickers {
		base := 9 + float64((profile.ID+idx)%5)
		season := 1 + math.Sin((float64(at.YearDay()+idx*7+profile.ID) / 17))
		raw[idx] = base * season
		if raw[idx] < 1 {
			raw[idx] = 1
		}
		sum += raw[idx]
	}

	weights := make([]float64, len(raw))
	for idx, value := range raw {
		weights[idx] = value / sum * 100
	}
	return weights
}

func mockTickerWeight(profile *Profile, ticker string, at time.Time, idx int) float64 {
	baseWeights := mockWeights(profile, at)
	for i, currentTicker := range mockTickers {
		if currentTicker == ticker {
			wave := math.Sin(float64(idx+i+profile.ID) / 8)
			return math.Max(0, baseWeights[i]+wave*0.8)
		}
	}
	return 0
}

func mockOperations(profile *Profile) []dto.PortfolioOperationHistoryItem {
	count := 180
	items := make([]dto.PortfolioOperationHistoryItem, 0, count)
	now := time.Now().UTC()
	for idx := 0; idx < count; idx++ {
		instrumentID := fmt.Sprintf("MOCK-%d-%d", profile.ID, (idx%len(mockTickers))+1)
		quantity := int64(1 + (idx % 4))
		price := float64(110 + (idx % 25))
		payment := float64(quantity) * price
		operationType := "OPERATION_TYPE_BUY"
		if idx%5 == 0 {
			operationType = "OPERATION_TYPE_SELL"
		}
		state := "OPERATION_STATE_EXECUTED"
		date := now.Add(-time.Duration(idx) * 8 * time.Hour)
		cursor := strconv.Itoa(idx)
		items = append(items, dto.PortfolioOperationHistoryItem{
			Cursor:             cursor,
			ID:                 fmt.Sprintf("mock-op-%d-%d", profile.ID, idx+1),
			Date:               &date,
			Type:               operationType,
			State:              state,
			Name:               fmt.Sprintf("Mock Asset %d", (idx%len(mockTickers))+1),
			Description:        "Deterministic mock operation",
			InstrumentID:       instrumentID,
			Figi:               instrumentID,
			InstrumentType:     "share",
			Quantity:           quantity,
			QuantityDone:       quantity,
			QuantityRest:       0,
			Payment:            roundFloat(payment, 2),
			PaymentCurrency:    "RUB",
			Price:              roundFloat(price, 2),
			PriceCurrency:      "RUB",
			Commission:         roundFloat(payment*0.001, 2),
			CommissionCurrency: "RUB",
		})
	}
	return items
}

func resolveDates(from, till string, intervalDays int) []time.Time {
	const dateLayout = "2006-01-02"
	now := time.Now().UTC()
	start := now.AddDate(0, -12, 0)
	end := now

	if strings.TrimSpace(from) != "" {
		if parsed, err := time.Parse(dateLayout, strings.TrimSpace(from)); err == nil {
			start = parsed.UTC()
		}
	}
	if strings.TrimSpace(till) != "" {
		if parsed, err := time.Parse(dateLayout, strings.TrimSpace(till)); err == nil {
			end = parsed.UTC()
		}
	}
	if start.After(end) {
		start, end = end, start
	}

	step := 1
	if intervalDays > 1 {
		step = intervalDays
	}
	dates := make([]time.Time, 0, 128)
	for current := start; !current.After(end); current = current.AddDate(0, 0, step) {
		dates = append(dates, current)
	}
	if len(dates) == 0 {
		return []time.Time{end}
	}
	return dates
}

func roundFloat(value float64, precision int) float64 {
	if precision < 0 {
		return value
	}
	multiplier := math.Pow(10, float64(precision))
	return math.Round(value*multiplier) / multiplier
}
