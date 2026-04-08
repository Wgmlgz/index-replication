package tbank

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

type fakeFetcher struct {
	mu     sync.Mutex
	points []moexdomain.IndexHistoryPoint
}

func (f *fakeFetcher) GetShareSecurityHistory(
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

func (f *fakeFetcher) GetShareSecurityCurrency(
	_ context.Context,
	_ string,
	_ string,
) (string, error) {
	return "RUB", nil
}

func TestBuildCompositionSnapshotsByDate_ChangesOnNoTradeDayWithMarketPrice(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	priceSvc := marketprice.NewService(
		repository.NewMarketPriceRepository(db),
		repository.NewMoexDataRepository(db),
		repository.NewMoexSyncRepository(db),
		&fakeFetcher{
			points: []moexdomain.IndexHistoryPoint{
				{TradeDate: "2026-01-02", Close: floatPtr(100)},
				{TradeDate: "2026-01-03", Close: floatPtr(120)},
			},
		},
	)
	svc := &Service{marketPrices: priceSvc}

	portfolio := &AccountPortfolioResponse{
		TotalAmountPortfolioCurrency: "RUB",
		Positions: []PortfolioPosition{
			{
				Ticker:       "SBER",
				InstrumentID: "UID1",
				Quantity:     10,
				CurrentPrice: 100,
				CurrentValue: 1000,
				Currency:     "RUB",
			},
		},
	}

	snapshots := svc.buildCompositionSnapshotsByDate(
		context.Background(),
		portfolio,
		nil,
		[]string{"2026-01-02", "2026-01-03"},
	)
	if len(snapshots["2026-01-02"]) != 1 || len(snapshots["2026-01-03"]) != 1 {
		t.Fatalf("unexpected snapshots: %+v", snapshots)
	}
	day2 := snapshots["2026-01-02"][0].CurrentValue
	day3 := snapshots["2026-01-03"][0].CurrentValue
	if day2 == day3 {
		t.Fatalf("expected no-trade day valuation change, got day2=%.2f day3=%.2f", day2, day3)
	}
	if day3 != 1200 {
		t.Fatalf("expected day3 value 1200, got %.2f", day3)
	}
}

func TestBuildCompositionSnapshotsByDate_FallsBackToReferencePriceWhenQuoteMissing(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	priceSvc := marketprice.NewService(
		repository.NewMarketPriceRepository(db),
		repository.NewMoexDataRepository(db),
		repository.NewMoexSyncRepository(db),
		&fakeFetcher{},
	)
	svc := &Service{marketPrices: priceSvc}

	portfolio := &AccountPortfolioResponse{
		Positions: []PortfolioPosition{
			{
				Ticker:       "SBER",
				InstrumentID: "UID1",
				Quantity:     10,
				CurrentPrice: 100,
				CurrentValue: 1000,
				Currency:     "RUB",
			},
		},
	}

	snapshots := svc.buildCompositionSnapshotsByDate(
		context.Background(),
		portfolio,
		nil,
		[]string{"2026-01-03"},
	)
	if len(snapshots["2026-01-03"]) != 1 {
		t.Fatalf("expected one snapshot row")
	}
	entry := snapshots["2026-01-03"][0]
	if entry.CurrentPrice != 100 {
		t.Fatalf("expected fallback current price 100, got %.2f", entry.CurrentPrice)
	}
	if entry.CurrentValue != 1000 {
		t.Fatalf("expected fallback current value 1000, got %.2f", entry.CurrentValue)
	}
}

func TestDownsampleDateStrings_AlwaysKeepsEndDate(t *testing.T) {
	dates := []string{
		"2026-01-01",
		"2026-01-02",
		"2026-01-03",
		"2026-01-04",
		"2026-01-05",
		"2026-01-06",
		"2026-01-07",
		"2026-01-08",
		"2026-01-09",
		"2026-01-10",
	}
	got := downsampleDateStrings(dates, 3)
	if len(got) == 0 {
		t.Fatalf("expected non-empty result")
	}
	if got[len(got)-1] != "2026-01-10" {
		t.Fatalf("expected exact end date in sampled output, got %v", got)
	}
}

func floatPtr(value float64) *float64 {
	return &value
}
