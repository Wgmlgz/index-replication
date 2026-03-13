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
		ModeKey:             "full",
		ModeParams:          map[string]interface{}{},
		TotalPortfolioValue: 2000,
		Params: PlanningParams{
			QuantityPrecision: 6,
			MinDeltaQuantity:  1e-6,
		},
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 10, CurrentWeight: 50, ReferencePrice: ptrFloat(100)},
			{Ticker: "BBB", InstrumentID: "BBB", CurrentQuantity: 5, CurrentWeight: 50, ReferencePrice: ptrFloat(200)},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: ptrFloat(60)},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: ptrFloat(40)},
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
		ModeKey:             "full",
		ModeParams:          map[string]interface{}{},
		TotalPortfolioValue: 2000,
		Params: PlanningParams{
			QuantityPrecision: 6,
			MinDeltaQuantity:  1e-6,
		},
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 10, CurrentWeight: 50, ReferencePrice: ptrFloat(100)},
			{Ticker: "BBB", InstrumentID: "BBB", CurrentQuantity: 5, CurrentWeight: 50, ReferencePrice: ptrFloat(200)},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: ptrFloat(60)},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: ptrFloat(40)},
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
	if output.Summary.UnresolvedItems != 0 {
		t.Fatalf("expected no unresolved items, got %d", output.Summary.UnresolvedItems)
	}
}

func TestPlanner_SampledModeBasicScenario(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey: "sampled",
		ModeParams: map[string]interface{}{
			"target_count": 2,
		},
		TotalPortfolioValue: 1000,
		Params:              PlanningParams{QuantityPrecision: 6, MinDeltaQuantity: 1e-6},
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 4, CurrentWeight: 40, ReferencePrice: ptrFloat(100)},
			{Ticker: "BBB", InstrumentID: "BBB", CurrentQuantity: 3, CurrentWeight: 30, ReferencePrice: ptrFloat(100)},
			{Ticker: "CCC", InstrumentID: "CCC", CurrentQuantity: 3, CurrentWeight: 30, ReferencePrice: ptrFloat(100)},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: ptrFloat(50)},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: ptrFloat(30)},
			{Ticker: "CCC", InstrumentID: "CCC", TargetWeight: ptrFloat(20)},
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

	if aaa.TargetWeight != 62.5 {
		t.Fatalf("expected AAA target weight 62.5, got %v", aaa.TargetWeight)
	}
	if bbb.TargetWeight != 37.5 {
		t.Fatalf("expected BBB target weight 37.5, got %v", bbb.TargetWeight)
	}
	if ccc.TargetWeight != 0 || ccc.Side != ItemSideSell {
		t.Fatalf("expected CCC to be sell to zero, got %+v", ccc)
	}
}

func TestPlanner_MissingBenchmarkDataCreatesUnresolvedItem(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey:             "full",
		ModeParams:          map[string]interface{}{},
		TotalPortfolioValue: 1000,
		Params:              PlanningParams{QuantityPrecision: 6, MinDeltaQuantity: 1e-6},
		Holdings:            []Holding{},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: ptrFloat(60)},
			{Ticker: "MISSING", InstrumentID: "MISSING", TargetWeight: nil},
		},
	})
	if err != nil {
		t.Fatalf("plan full mode with missing benchmark data: %v", err)
	}

	if output.Summary.UnresolvedItems == 0 {
		t.Fatalf("expected unresolved items")
	}

	foundMissing := false
	for _, item := range output.Items {
		if item.Ticker == "MISSING" {
			foundMissing = true
			if item.Status != ItemStatusUnresolved {
				t.Fatalf("expected unresolved status, got %+v", item)
			}
			if item.Metadata["reason"] != "missing_target_weight" {
				t.Fatalf("expected missing_target_weight reason, got %+v", item.Metadata)
			}
		}
	}
	if !foundMissing {
		t.Fatalf("expected unresolved MISSING item")
	}
}

func TestPlanner_RoundingAndZeroDeltaFiltering(t *testing.T) {
	svc := newPlannerService()

	output, err := svc.Plan(Input{
		ModeKey:             "full",
		ModeParams:          map[string]interface{}{},
		TotalPortfolioValue: 100,
		Params:              PlanningParams{QuantityPrecision: 2, MinDeltaQuantity: 0.05},
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 1.0, CurrentWeight: 100, ReferencePrice: ptrFloat(100)},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: ptrFloat(100)},
		},
	})
	if err != nil {
		t.Fatalf("plan rounding scenario: %v", err)
	}

	if len(output.Items) != 0 {
		t.Fatalf("expected zero-delta item to be filtered, got %d items", len(output.Items))
	}
	if output.Summary.FilteredZeroDelta != 1 {
		t.Fatalf("expected one filtered zero-delta item, got %d", output.Summary.FilteredZeroDelta)
	}
}

func ptrFloat(value float64) *float64 {
	return &value
}
