package portfolio

import (
	"context"
	"sync"
	"testing"
	"time"

	"server/internal/marketprice"
	moexdomain "server/internal/moex/domain"
	"server/internal/repository"
	"server/internal/testutil"
)

type fakeVirtualFetcher struct {
	mu     sync.Mutex
	points []moexdomain.IndexHistoryPoint
}

func (f *fakeVirtualFetcher) GetShareSecurityHistory(
	_ context.Context,
	_ string,
	_ string,
	from string,
	till string,
) ([]moexdomain.IndexHistoryPoint, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	fromDate, _ := time.Parse("2006-01-02", from)
	tillDate, _ := time.Parse("2006-01-02", till)
	if fromDate.After(tillDate) {
		fromDate, tillDate = tillDate, fromDate
	}

	result := make([]moexdomain.IndexHistoryPoint, 0, len(f.points))
	for _, point := range f.points {
		pointDate, err := time.Parse("2006-01-02", point.TradeDate)
		if err != nil {
			continue
		}
		if pointDate.Before(fromDate) || pointDate.After(tillDate) {
			continue
		}
		result = append(result, point)
	}
	return result, nil
}

func TestVirtualProvider_HistoryChangesOnNoTradeDayWithMarketPrice(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	priceSvc := marketprice.NewService(
		repository.NewMarketPriceRepository(db),
		repository.NewMoexDataRepository(db),
		repository.NewMoexSyncRepository(db),
		&fakeVirtualFetcher{
			points: []moexdomain.IndexHistoryPoint{
				{TradeDate: "2026-01-02", Close: virtualFloatPtr(100)},
				{TradeDate: "2026-01-03", Close: virtualFloatPtr(120)},
			},
		},
	)
	provider := NewVirtualProvider(repository.NewVirtualPortfolioTransactionsRepository(db), priceSvc)
	profile := &Profile{ID: 801, UserID: 91, Provider: "virtual", Name: "Virtual M2M"}

	if _, err := provider.RunAction(context.Background(), profile, "deposit_cash", map[string]interface{}{
		"action_id":   "33333333-3333-3333-3333-333333333331",
		"amount":      10000,
		"currency":    "RUB",
		"executed_at": "2026-01-01",
	}); err != nil {
		t.Fatalf("deposit action: %v", err)
	}
	if _, err := provider.RunAction(context.Background(), profile, "buy", map[string]interface{}{
		"action_id":   "33333333-3333-3333-3333-333333333332",
		"ticker":      "SBER",
		"quantity":    10,
		"price":       100,
		"currency":    "RUB",
		"executed_at": "2026-01-02",
	}); err != nil {
		t.Fatalf("buy action: %v", err)
	}

	history, err := provider.GetHistory(context.Background(), profile, "2026-01-02", "2026-01-03", 1)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("expected 2 history points, got %d", len(history))
	}
	if history[0].TotalAmountPortfolio != 10000 {
		t.Fatalf("expected 2026-01-02 total 10000, got %.2f", history[0].TotalAmountPortfolio)
	}
	if history[1].TotalAmountPortfolio != 10200 {
		t.Fatalf("expected 2026-01-03 total 10200, got %.2f", history[1].TotalAmountPortfolio)
	}
}

func TestVirtualProvider_IntervalSamplingKeepsExactEndDate(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	priceSvc := marketprice.NewService(
		repository.NewMarketPriceRepository(db),
		repository.NewMoexDataRepository(db),
		repository.NewMoexSyncRepository(db),
		&fakeVirtualFetcher{
			points: []moexdomain.IndexHistoryPoint{
				{TradeDate: "2026-01-01", Close: virtualFloatPtr(100)},
				{TradeDate: "2026-01-10", Close: virtualFloatPtr(110)},
			},
		},
	)
	provider := NewVirtualProvider(repository.NewVirtualPortfolioTransactionsRepository(db), priceSvc)
	profile := &Profile{ID: 802, UserID: 92, Provider: "virtual", Name: "Virtual Sampling"}

	if _, err := provider.RunAction(context.Background(), profile, "deposit_cash", map[string]interface{}{
		"action_id":   "33333333-3333-3333-3333-333333333341",
		"amount":      10000,
		"currency":    "RUB",
		"executed_at": "2026-01-01",
	}); err != nil {
		t.Fatalf("deposit action: %v", err)
	}
	if _, err := provider.RunAction(context.Background(), profile, "buy", map[string]interface{}{
		"action_id":   "33333333-3333-3333-3333-333333333342",
		"ticker":      "SBER",
		"quantity":    10,
		"price":       100,
		"currency":    "RUB",
		"executed_at": "2026-01-01",
	}); err != nil {
		t.Fatalf("buy action: %v", err)
	}

	history, err := provider.GetHistory(context.Background(), profile, "2026-01-01", "2026-01-10", 3)
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(history) == 0 {
		t.Fatalf("expected sampled points")
	}
	if history[len(history)-1].TradeDate != "2026-01-10" {
		t.Fatalf("expected exact end date in sampled history, got %q", history[len(history)-1].TradeDate)
	}
}

func TestVirtualProvider_FallsBackToLegacyPriceWhenQuoteMissing(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	priceSvc := marketprice.NewService(
		repository.NewMarketPriceRepository(db),
		repository.NewMoexDataRepository(db),
		repository.NewMoexSyncRepository(db),
		&fakeVirtualFetcher{},
	)
	provider := NewVirtualProvider(repository.NewVirtualPortfolioTransactionsRepository(db), priceSvc)
	profile := &Profile{ID: 803, UserID: 93, Provider: "virtual", Name: "Virtual Fallback"}

	if _, err := provider.RunAction(context.Background(), profile, "deposit_cash", map[string]interface{}{
		"action_id":   "33333333-3333-3333-3333-333333333351",
		"amount":      10000,
		"currency":    "RUB",
		"executed_at": "2026-01-01",
	}); err != nil {
		t.Fatalf("deposit action: %v", err)
	}
	if _, err := provider.RunAction(context.Background(), profile, "buy", map[string]interface{}{
		"action_id":   "33333333-3333-3333-3333-333333333352",
		"ticker":      "SBER",
		"quantity":    10,
		"price":       100,
		"currency":    "RUB",
		"executed_at": "2026-01-02",
	}); err != nil {
		t.Fatalf("buy action: %v", err)
	}

	composition, err := provider.GetComposition(context.Background(), profile, "2026-01-03")
	if err != nil {
		t.Fatalf("GetComposition: %v", err)
	}
	if len(composition) != 1 {
		t.Fatalf("expected one composition row, got %d", len(composition))
	}
	if composition[0].CurrentPrice != 100 {
		t.Fatalf("expected fallback current price 100, got %.2f", composition[0].CurrentPrice)
	}
	if composition[0].CurrentValue != 1000 {
		t.Fatalf("expected fallback current value 1000, got %.2f", composition[0].CurrentValue)
	}
}

func virtualFloatPtr(value float64) *float64 {
	return &value
}
