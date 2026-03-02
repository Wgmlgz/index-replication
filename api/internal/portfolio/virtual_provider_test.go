package portfolio

import (
	"context"
	"errors"
	"testing"

	"server/internal/repository"
	"server/internal/testutil"
)

func TestVirtualProvider_StateTransitions(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	txnRepo := repository.NewVirtualPortfolioTransactionsRepository(db)
	provider := NewVirtualProvider(txnRepo)
	profile := &Profile{ID: 501, UserID: 77, Provider: "virtual", Name: "Virtual A"}

	_, err := provider.RunAction(context.Background(), profile, "deposit_cash", map[string]interface{}{
		"amount":      10000,
		"currency":    "rub",
		"executed_at": "2026-01-01",
	})
	if err != nil {
		t.Fatalf("deposit action failed: %v", err)
	}

	_, err = provider.RunAction(context.Background(), profile, "buy", map[string]interface{}{
		"ticker":      "sber",
		"quantity":    10,
		"price":       100,
		"currency":    "RUB",
		"executed_at": "2026-01-02",
	})
	if err != nil {
		t.Fatalf("buy action failed: %v", err)
	}

	_, err = provider.RunAction(context.Background(), profile, "sell", map[string]interface{}{
		"ticker":      "SBER",
		"quantity":    4,
		"price":       120,
		"currency":    "RUB",
		"executed_at": "2026-01-03",
	})
	if err != nil {
		t.Fatalf("sell action failed: %v", err)
	}

	summary, err := provider.GetSummary(context.Background(), profile)
	if err != nil {
		t.Fatalf("summary failed: %v", err)
	}
	if summary.TotalAmountPortfolio != 10200 {
		t.Fatalf("expected total 10200, got %.2f", summary.TotalAmountPortfolio)
	}
	if len(summary.Positions) != 1 {
		t.Fatalf("expected 1 position, got %d", len(summary.Positions))
	}
	if summary.Positions[0].Ticker != "SBER" {
		t.Fatalf("expected ticker SBER, got %q", summary.Positions[0].Ticker)
	}
	if summary.Positions[0].Quantity != 6 {
		t.Fatalf("expected quantity 6, got %.4f", summary.Positions[0].Quantity)
	}
	if len(summary.Money) != 1 || summary.Money[0].Available != 9480 {
		t.Fatalf("expected cash 9480 RUB, got %+v", summary.Money)
	}

	history, err := provider.GetHistory(context.Background(), profile, "2026-01-01", "2026-01-03", 1)
	if err != nil {
		t.Fatalf("history failed: %v", err)
	}
	if len(history) != 3 {
		t.Fatalf("expected 3 history points, got %d", len(history))
	}
	if history[0].TotalAmountPortfolio != 10000 || history[2].TotalAmountPortfolio != 10200 {
		t.Fatalf("unexpected history totals: %+v", history)
	}

	composition, err := provider.GetComposition(context.Background(), profile, "2026-01-03")
	if err != nil {
		t.Fatalf("composition failed: %v", err)
	}
	if len(composition) != 1 || composition[0].Ticker != "SBER" {
		t.Fatalf("unexpected composition: %+v", composition)
	}

	series, err := provider.GetCompositionSeries(
		context.Background(),
		profile,
		nil,
		10,
		"fixed",
		"2026-01-03",
		"2026-01-01",
		"2026-01-03",
		1,
	)
	if err != nil {
		t.Fatalf("composition series failed: %v", err)
	}
	if len(series["SBER"]) != 3 {
		t.Fatalf("expected 3 series points for SBER, got %d", len(series["SBER"]))
	}

	operations, err := provider.GetOperations(context.Background(), profile, "", 50)
	if err != nil {
		t.Fatalf("operations failed: %v", err)
	}
	if len(operations.Items) != 3 {
		t.Fatalf("expected 3 operations, got %d", len(operations.Items))
	}
	if operations.Items[0].Type != "OPERATION_TYPE_SELL" {
		t.Fatalf("expected latest operation SELL, got %s", operations.Items[0].Type)
	}

	providerAfterRestart := NewVirtualProvider(txnRepo)
	summaryAfterRestart, err := providerAfterRestart.GetSummary(context.Background(), profile)
	if err != nil {
		t.Fatalf("summary after restart failed: %v", err)
	}
	if summaryAfterRestart.TotalAmountPortfolio != 10200 {
		t.Fatalf("expected persisted total 10200, got %.2f", summaryAfterRestart.TotalAmountPortfolio)
	}
}

func TestVirtualProvider_RejectsInvalidActions(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	txnRepo := repository.NewVirtualPortfolioTransactionsRepository(db)
	provider := NewVirtualProvider(txnRepo)
	profile := &Profile{ID: 601, UserID: 88, Provider: "virtual", Name: "Virtual B"}

	_, err := provider.RunAction(context.Background(), profile, "buy", map[string]interface{}{
		"ticker":   "GAZP",
		"quantity": 10,
		"price":    100,
	})
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected insufficient cash to return ErrInvalidRequest, got %v", err)
	}

	_, err = provider.RunAction(context.Background(), profile, "deposit_cash", map[string]interface{}{
		"amount": 5000,
	})
	if err != nil {
		t.Fatalf("deposit failed: %v", err)
	}

	_, err = provider.RunAction(context.Background(), profile, "buy", map[string]interface{}{
		"ticker":   "GAZP",
		"quantity": 10,
		"price":    100,
	})
	if err != nil {
		t.Fatalf("buy failed: %v", err)
	}

	_, err = provider.RunAction(context.Background(), profile, "sell", map[string]interface{}{
		"ticker":   "GAZP",
		"quantity": 11,
		"price":    100,
	})
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected oversell to return ErrInvalidRequest, got %v", err)
	}
}
