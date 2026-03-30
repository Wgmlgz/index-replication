package planner

import (
	"reflect"
	"testing"
)

func newPlannerService() *Service {
	registry := NewRegistry(
		NewFullAlgorithm(),
		NewSampledAlgorithm(),
	)
	return NewService(registry)
}

func TestPlanner_DeterministicOutput(t *testing.T) {
	svc := newPlannerService()

	input := Input{
		ModeKey:           "full",
		ModeParams:        map[string]interface{}{},
		InvestableCapital: 2000,
		Params: PlanningParams{
			QuantityPrecision: 6,
		},
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 10},
			{Ticker: "BBB", InstrumentID: "BBB", CurrentQuantity: 5},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 60},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: 40},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Price: 100},
			{Ticker: "BBB", InstrumentID: "BBB", Price: 200},
		},
	}

	first, err := svc.Plan(input)
	if err != nil {
		t.Fatalf("plan first call: %v", err)
	}
	second, err := svc.Plan(input)
	if err != nil {
		t.Fatalf("plan second call: %v", err)
	}

	if !reflect.DeepEqual(first, second) {
		t.Fatalf("expected deterministic output, got different results")
	}
}

func TestPlanner_FullModeBasicScenario(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey:           "full",
		ModeParams:        map[string]interface{}{},
		InvestableCapital: 2000,
		Params: PlanningParams{
			QuantityPrecision: 6,
		},
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 10},
			{Ticker: "BBB", InstrumentID: "BBB", CurrentQuantity: 5},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 60},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: 40},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Price: 100},
			{Ticker: "BBB", InstrumentID: "BBB", Price: 200},
		},
	})
	if err != nil {
		t.Fatalf("plan full mode: %v", err)
	}

	if len(output.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(output.Items))
	}

	if output.Items[0].Ticker != "AAA" || output.Items[0].Side != ItemSideBuy {
		t.Fatalf("unexpected first item: %+v", output.Items[0])
	}
	if output.Items[0].DeltaQuantity != 2 {
		t.Fatalf("expected AAA delta 2, got %v", output.Items[0].DeltaQuantity)
	}
	if output.Items[1].Ticker != "BBB" || output.Items[1].Side != ItemSideSell {
		t.Fatalf("unexpected second item: %+v", output.Items[1])
	}
	if output.Items[1].DeltaQuantity != -1 {
		t.Fatalf("expected BBB delta -1, got %v", output.Items[1].DeltaQuantity)
	}

	summary := BuildSummary(output.Items, 2000)
	if summary.UnresolvedItems != 0 {
		t.Fatalf("expected no unresolved items, got %d", summary.UnresolvedItems)
	}
}

func TestPlanner_SampledModeBasicScenario(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey: "sampled",
		ModeParams: map[string]interface{}{
			"target_count": 2,
		},
		InvestableCapital: 1000,
		Params:            PlanningParams{QuantityPrecision: 6},
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 4},
			{Ticker: "BBB", InstrumentID: "BBB", CurrentQuantity: 3},
			{Ticker: "CCC", InstrumentID: "CCC", CurrentQuantity: 3},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 50},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: 30},
			{Ticker: "CCC", InstrumentID: "CCC", TargetWeight: 20},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Price: 100},
			{Ticker: "BBB", InstrumentID: "BBB", Price: 100},
			{Ticker: "CCC", InstrumentID: "CCC", Price: 100},
		},
	})
	if err != nil {
		t.Fatalf("plan sampled mode: %v", err)
	}

	if len(output.Items) != 3 {
		t.Fatalf("expected 3 items (AAA, BBB, CCC sell), got %d", len(output.Items))
	}

	var aaa, bbb, ccc Item
	for _, item := range output.Items {
		switch item.Ticker {
		case "AAA":
			aaa = item
		case "BBB":
			bbb = item
		case "CCC":
			ccc = item
		}
	}

	if aaa.TargetWeight != 60 {
		t.Fatalf("expected AAA target weight 60, got %v", aaa.TargetWeight)
	}
	if aaa.IdealWeight != 62.5 {
		t.Fatalf("expected AAA ideal weight 62.5, got %v", aaa.IdealWeight)
	}
	if bbb.TargetWeight != 40 {
		t.Fatalf("expected BBB target weight 40, got %v", bbb.TargetWeight)
	}
	if bbb.IdealWeight != 37.5 {
		t.Fatalf("expected BBB ideal weight 37.5, got %v", bbb.IdealWeight)
	}
	if ccc.TargetWeight != 0 || ccc.IdealWeight != 0 || ccc.Side != ItemSideSell {
		t.Fatalf("expected CCC to be sell to zero, got %+v", ccc)
	}
}

func TestPlanner_MissingPriceCreatesUnresolvedItem(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey:           "full",
		ModeParams:        map[string]interface{}{},
		InvestableCapital: 1000,
		Params:            PlanningParams{QuantityPrecision: 6},
		Holdings:          []Holding{},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 60},
		},
		Instruments: []InstrumentInfo{},
	})
	if err != nil {
		t.Fatalf("plan full mode with missing prices: %v", err)
	}

	if len(output.Items) != 1 {
		t.Fatalf("expected one unresolved item, got %d", len(output.Items))
	}
	if output.Items[0].Status != ItemStatusUnresolved {
		t.Fatalf("expected unresolved status, got %+v", output.Items[0])
	}
	if output.Items[0].Metadata["reason"] != "missing_reference_price" {
		t.Fatalf("expected missing_reference_price reason, got %+v", output.Items[0].Metadata)
	}
}

func TestPlanner_RoundingAndZeroDeltaIncludedInOutput(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey:           "full",
		ModeParams:        map[string]interface{}{},
		InvestableCapital: 100,
		Params:            PlanningParams{QuantityPrecision: 2},
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 1.0},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 100},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Price: 100},
		},
	})
	if err != nil {
		t.Fatalf("plan rounding scenario: %v", err)
	}

	if len(output.Items) != 1 {
		t.Fatalf("expected zero-delta item to be included, got %d items", len(output.Items))
	}
	if output.Items[0].DeltaQuantity != 0 {
		t.Fatalf("expected zero delta quantity, got %v", output.Items[0].DeltaQuantity)
	}
}

func TestPlanner_LotSizeProducesIntegerTrades(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey:           "full",
		ModeParams:        map[string]interface{}{},
		InvestableCapital: 1000,
		Holdings:          []Holding{},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 100},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Price: 90, Currency: "RUB", LotSize: 10},
		},
		Money: []Money{{Currency: "RUB", Available: 1000}},
	})
	if err != nil {
		t.Fatalf("plan lot-size scenario: %v", err)
	}

	if len(output.Items) != 1 {
		t.Fatalf("expected one item, got %d", len(output.Items))
	}
	item := output.Items[0]
	if item.TargetQuantity != 10 {
		t.Fatalf("expected target quantity 10, got %v", item.TargetQuantity)
	}
	if item.DeltaQuantity != 10 {
		t.Fatalf("expected delta quantity 10, got %v", item.DeltaQuantity)
	}
}

func TestPlanner_SellFundsBuysInSameCurrency(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey:           "full",
		ModeParams:        map[string]interface{}{},
		InvestableCapital: 1000,
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 10},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 0},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: 100},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Price: 100, Currency: "RUB"},
			{Ticker: "BBB", InstrumentID: "BBB", Price: 100, Currency: "RUB"},
		},
		Money: []Money{{Currency: "RUB", Available: 0}},
	})
	if err != nil {
		t.Fatalf("plan sell-funds-buy scenario: %v", err)
	}

	if len(output.Items) != 2 {
		t.Fatalf("expected two items, got %d", len(output.Items))
	}
	var sellFound, buyFound bool
	for _, item := range output.Items {
		if item.Ticker == "AAA" && item.Side == ItemSideSell && item.DeltaQuantity == -10 {
			sellFound = true
		}
		if item.Ticker == "BBB" && item.Side == ItemSideBuy && item.DeltaQuantity == 10 {
			buyFound = true
		}
	}
	if !sellFound || !buyFound {
		t.Fatalf("expected sell AAA -10 and buy BBB +10, got %+v", output.Items)
	}
	if len(output.Money) != 1 || output.Money[0].Currency != "RUB" {
		t.Fatalf("expected RUB money output, got %+v", output.Money)
	}
	if output.Money[0].Available != 0 {
		t.Fatalf("expected RUB available 0 after rebalance, got %v", output.Money[0].Available)
	}
}

func TestPlanner_MultiCurrencyBudgetSeparation(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey:           "full",
		ModeParams:        map[string]interface{}{},
		InvestableCapital: 2000,
		Holdings:          []Holding{},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 50},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: 50},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Price: 100, Currency: "RUB"},
			{Ticker: "BBB", InstrumentID: "BBB", Price: 100, Currency: "USD"},
		},
		Money: []Money{
			{Currency: "RUB", Available: 1000},
			{Currency: "USD", Available: 0},
		},
	})
	if err != nil {
		t.Fatalf("plan multi-currency scenario: %v", err)
	}

	if len(output.Items) != 2 {
		t.Fatalf("expected two items, got %d", len(output.Items))
	}
	var rubPlanned, usdBlocked bool
	for _, item := range output.Items {
		if item.Ticker == "AAA" && item.Status == ItemStatusPlanned && item.DeltaQuantity == 10 {
			rubPlanned = true
		}
		if item.Ticker == "BBB" && item.Status == ItemStatusUnresolved && item.Metadata["reason"] == "insufficient_cash" {
			usdBlocked = true
		}
	}
	if !rubPlanned || !usdBlocked {
		t.Fatalf("expected RUB buy planned and USD buy unresolved, got %+v", output.Items)
	}
}
