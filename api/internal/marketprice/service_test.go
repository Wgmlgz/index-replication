package marketprice

import (
	"context"
	"sync"
	"testing"
	"time"

	moexdomain "server/internal/moex/domain"
	"server/internal/repository"
	"server/internal/testutil"
)

type fakeSecurityHistoryFetcher struct {
	mu     sync.Mutex
	calls  []fetchCall
	points []moexdomain.IndexHistoryPoint
}

type fetchCall struct {
	Secid string
	Board string
	From  string
	Till  string
}

func (f *fakeSecurityHistoryFetcher) GetShareSecurityHistory(
	_ context.Context,
	secid, board, from, till string,
) ([]moexdomain.IndexHistoryPoint, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, fetchCall{
		Secid: secid,
		Board: board,
		From:  from,
		Till:  till,
	})

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

func (f *fakeSecurityHistoryFetcher) callCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}

func (f *fakeSecurityHistoryFetcher) callsSnapshot() []fetchCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	result := make([]fetchCall, len(f.calls))
	copy(result, f.calls)
	return result
}

func TestMarketPriceService_CacheHitUsesStoredData(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	repo := repository.NewMarketPriceRepository(db)
	coverageReader := repository.NewMoexDataRepository(db)
	coverageWriter := repository.NewMoexSyncRepository(db)
	fetcher := &fakeSecurityHistoryFetcher{}
	svc := NewService(repo, coverageReader, coverageWriter, fetcher)

	if _, err := repo.UpsertSecurityHistory(context.Background(), "SBER", "TQBR", []moexdomain.IndexHistoryPoint{
		{TradeDate: "2026-01-03", Close: floatPtr(100)},
		{TradeDate: "2026-01-06", Close: floatPtr(110)},
	}); err != nil {
		t.Fatalf("seed history: %v", err)
	}

	// Covers from (2026-01-04 - 32d) through 2026-01-06.
	if err := coverageWriter.UpsertCoverage(
		context.Background(),
		coverageDatasetSecurityHistory,
		securityCoverageEntityKey("SBER", "TQBR"),
		mustDate("2025-12-03"),
		mustDate("2026-01-06"),
		true,
	); err != nil {
		t.Fatalf("seed coverage: %v", err)
	}

	series, err := svc.GetDailyAsOfPrices(context.Background(), InstrumentRangeRequest{
		Provider:      "virtual",
		InstrumentKey: "SBER",
		Ticker:        "SBER",
		From:          mustDate("2026-01-04"),
		To:            mustDate("2026-01-06"),
	})
	if err != nil {
		t.Fatalf("GetDailyAsOfPrices: %v", err)
	}
	if fetcher.callCount() != 0 {
		t.Fatalf("expected no upstream fetch, got %d calls", fetcher.callCount())
	}
	if got := series.Prices["2026-01-04"]; got != 100 {
		t.Fatalf("expected 2026-01-04 as-of close 100, got %.2f", got)
	}
	if got := series.Prices["2026-01-06"]; got != 110 {
		t.Fatalf("expected 2026-01-06 close 110, got %.2f", got)
	}
}

func TestMarketPriceService_CacheMissFetchesAndPersists(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	repo := repository.NewMarketPriceRepository(db)
	coverageReader := repository.NewMoexDataRepository(db)
	coverageWriter := repository.NewMoexSyncRepository(db)
	fetcher := &fakeSecurityHistoryFetcher{
		points: []moexdomain.IndexHistoryPoint{
			{TradeDate: "2026-01-03", Close: floatPtr(100)},
			{TradeDate: "2026-01-06", Close: floatPtr(110)},
		},
	}
	svc := NewService(repo, coverageReader, coverageWriter, fetcher)

	req := InstrumentRangeRequest{
		Provider:      "virtual",
		InstrumentKey: "SBER",
		Ticker:        "SBER",
		From:          mustDate("2026-01-04"),
		To:            mustDate("2026-01-06"),
	}

	first, err := svc.GetDailyAsOfPrices(context.Background(), req)
	if err != nil {
		t.Fatalf("first fetch: %v", err)
	}
	if fetcher.callCount() == 0 {
		t.Fatalf("expected upstream fetch on cache miss")
	}
	if got := first.Prices["2026-01-05"]; got != 100 {
		t.Fatalf("expected as-of price 100 on 2026-01-05, got %.2f", got)
	}

	rows, err := repo.ListSecurityHistory(context.Background(), "SBER", "TQBR", nil, nil)
	if err != nil {
		t.Fatalf("read persisted history: %v", err)
	}
	if len(rows) == 0 {
		t.Fatalf("expected persisted history rows")
	}

	callCount := fetcher.callCount()
	if _, err := svc.GetDailyAsOfPrices(context.Background(), req); err != nil {
		t.Fatalf("second fetch: %v", err)
	}
	if fetcher.callCount() != callCount {
		t.Fatalf("expected no additional upstream fetch on cache hit")
	}
}

func TestMarketPriceService_PartialCoverageFetchesOnlyMissingGap(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	repo := repository.NewMarketPriceRepository(db)
	coverageReader := repository.NewMoexDataRepository(db)
	coverageWriter := repository.NewMoexSyncRepository(db)
	fetcher := &fakeSecurityHistoryFetcher{
		points: []moexdomain.IndexHistoryPoint{
			{TradeDate: "2026-01-03", Close: floatPtr(100)},
			{TradeDate: "2026-01-04", Close: floatPtr(101)},
			{TradeDate: "2026-01-05", Close: floatPtr(102)},
			{TradeDate: "2026-01-06", Close: floatPtr(103)},
			{TradeDate: "2026-01-07", Close: floatPtr(104)},
			{TradeDate: "2026-01-08", Close: floatPtr(105)},
		},
	}
	svc := NewService(repo, coverageReader, coverageWriter, fetcher)

	if _, err := repo.UpsertSecurityHistory(context.Background(), "SBER", "TQBR", []moexdomain.IndexHistoryPoint{
		{TradeDate: "2026-01-03", Close: floatPtr(100)},
		{TradeDate: "2026-01-04", Close: floatPtr(101)},
		{TradeDate: "2026-01-05", Close: floatPtr(102)},
	}); err != nil {
		t.Fatalf("seed rows: %v", err)
	}
	if err := coverageWriter.UpsertCoverage(
		context.Background(),
		coverageDatasetSecurityHistory,
		securityCoverageEntityKey("SBER", "TQBR"),
		mustDate("2025-12-03"),
		mustDate("2026-01-05"),
		true,
	); err != nil {
		t.Fatalf("seed coverage: %v", err)
	}

	_, err := svc.GetDailyAsOfPrices(context.Background(), InstrumentRangeRequest{
		Provider:      "virtual",
		InstrumentKey: "SBER",
		Ticker:        "SBER",
		From:          mustDate("2026-01-04"),
		To:            mustDate("2026-01-08"),
	})
	if err != nil {
		t.Fatalf("GetDailyAsOfPrices: %v", err)
	}

	calls := fetcher.callsSnapshot()
	if len(calls) != 1 {
		t.Fatalf("expected one upstream call for uncovered gap, got %d", len(calls))
	}
	if calls[0].From != "2026-01-06" || calls[0].Till != "2026-01-08" {
		t.Fatalf("expected fetch for gap 2026-01-06..2026-01-08, got %s..%s", calls[0].From, calls[0].Till)
	}
}

func TestMarketPriceService_AsOfFallbackWeekend(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	repo := repository.NewMarketPriceRepository(db)
	coverageReader := repository.NewMoexDataRepository(db)
	coverageWriter := repository.NewMoexSyncRepository(db)
	fetcher := &fakeSecurityHistoryFetcher{
		points: []moexdomain.IndexHistoryPoint{
			{TradeDate: "2026-01-02", Close: floatPtr(100)},
			{TradeDate: "2026-01-05", Close: floatPtr(110)},
		},
	}
	svc := NewService(repo, coverageReader, coverageWriter, fetcher)

	series, err := svc.GetDailyAsOfPrices(context.Background(), InstrumentRangeRequest{
		Provider:      "virtual",
		InstrumentKey: "SBER",
		Ticker:        "SBER",
		From:          mustDate("2026-01-03"),
		To:            mustDate("2026-01-04"),
	})
	if err != nil {
		t.Fatalf("GetDailyAsOfPrices: %v", err)
	}
	if got := series.Prices["2026-01-03"]; got != 100 {
		t.Fatalf("expected Saturday as-of 100, got %.2f", got)
	}
	if got := series.Prices["2026-01-04"]; got != 100 {
		t.Fatalf("expected Sunday as-of 100, got %.2f", got)
	}
}

func floatPtr(value float64) *float64 {
	return &value
}

func mustDate(value string) time.Time {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		panic(err)
	}
	return parsed.UTC()
}
