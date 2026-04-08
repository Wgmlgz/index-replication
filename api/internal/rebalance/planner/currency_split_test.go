package planner

import (
	"errors"
	"math"
	"reflect"
	"testing"
)

func TestSplitInputByCurrency_GroupsInputAndSplitsCapitalByBenchmarkWeight(t *testing.T) {
	input := Input{
		ModeKey:           "full",
		ModeParams:        map[string]interface{}{"quantity_precision": float64(6)},
		InvestableCapital: 2000,
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 10},
			{Ticker: "BBB", InstrumentID: "BBB", CurrentQuantity: 5},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 60},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: 40},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Price: 100, Currency: "RUB"},
			{Ticker: "BBB", InstrumentID: "BBB", Price: 200, Currency: "USD"},
		},
		Money: []Money{
			{Currency: "RUB", Available: 10},
			{Currency: "USD", Available: 20},
		},
		Params: PlanningParams{QuantityPrecision: 6},
	}

	scoped := splitInputByCurrency(input)
	if len(scoped) != 2 {
		t.Fatalf("expected 2 currency buckets, got %d", len(scoped))
	}

	if scoped[0].Currency != "RUB" || scoped[1].Currency != "USD" {
		t.Fatalf("unexpected currency order: %+v", scoped)
	}

	rub := scoped[0].Input
	usd := scoped[1].Input

	if len(rub.Holdings) != 1 || rub.Holdings[0].Ticker != "AAA" {
		t.Fatalf("unexpected RUB holdings: %+v", rub.Holdings)
	}
	if len(usd.Holdings) != 1 || usd.Holdings[0].Ticker != "BBB" {
		t.Fatalf("unexpected USD holdings: %+v", usd.Holdings)
	}
	if len(rub.Benchmark) != 1 || rub.Benchmark[0].Ticker != "AAA" {
		t.Fatalf("unexpected RUB benchmark: %+v", rub.Benchmark)
	}
	if len(usd.Benchmark) != 1 || usd.Benchmark[0].Ticker != "BBB" {
		t.Fatalf("unexpected USD benchmark: %+v", usd.Benchmark)
	}
	if len(rub.Instruments) != 1 || rub.Instruments[0].Ticker != "AAA" {
		t.Fatalf("unexpected RUB instruments: %+v", rub.Instruments)
	}
	if len(usd.Instruments) != 1 || usd.Instruments[0].Ticker != "BBB" {
		t.Fatalf("unexpected USD instruments: %+v", usd.Instruments)
	}

	if !almostEqual(rub.InvestableCapital, 1200) {
		t.Fatalf("expected RUB investable capital 1200, got %v", rub.InvestableCapital)
	}
	if !almostEqual(usd.InvestableCapital, 800) {
		t.Fatalf("expected USD investable capital 800, got %v", usd.InvestableCapital)
	}
}

func TestSplitInputByCurrency_FallsBackToUnknownCurrencyBucket(t *testing.T) {
	input := Input{
		ModeKey:           "full",
		InvestableCapital: 500,
		Holdings: []Holding{
			{Ticker: "AAA", InstrumentID: "AAA", CurrentQuantity: 1},
		},
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 100},
		},
	}

	scoped := splitInputByCurrency(input)
	if len(scoped) != 1 {
		t.Fatalf("expected 1 bucket, got %d", len(scoped))
	}
	if scoped[0].Currency != "" {
		t.Fatalf("expected empty currency for unknown bucket, got %q", scoped[0].Currency)
	}
	if !almostEqual(scoped[0].Input.InvestableCapital, 500) {
		t.Fatalf("expected investable capital 500, got %v", scoped[0].Input.InvestableCapital)
	}
	if len(scoped[0].Input.Holdings) != 1 || scoped[0].Input.Holdings[0].Ticker != "AAA" {
		t.Fatalf("unexpected holdings in unknown bucket: %+v", scoped[0].Input.Holdings)
	}
}

func TestPlanPerCurrency_MergesOutputsInStableCurrencyOrder(t *testing.T) {
	input := Input{
		ModeKey:           "full",
		InvestableCapital: 1000,
		Benchmark: []BenchmarkConstituent{
			{Ticker: "AAA", InstrumentID: "AAA", TargetWeight: 50},
			{Ticker: "BBB", InstrumentID: "BBB", TargetWeight: 50},
		},
		Instruments: []InstrumentInfo{
			{Ticker: "BBB", InstrumentID: "BBB", Currency: "USD"},
			{Ticker: "AAA", InstrumentID: "AAA", Currency: "RUB"},
		},
	}

	calls := make([]string, 0, 2)
	output, err := planPerCurrency(input, func(currency string, scoped Input) (Output, error) {
		calls = append(calls, currency)
		return Output{
			Items: []Item{{Ticker: currency}},
			Money: []Money{{Currency: currency, Available: scoped.InvestableCapital}},
		}, nil
	})
	if err != nil {
		t.Fatalf("planPerCurrency returned error: %v", err)
	}

	if !reflect.DeepEqual(calls, []string{"RUB", "USD"}) {
		t.Fatalf("unexpected call order: %+v", calls)
	}
	if len(output.Items) != 2 || output.Items[0].Ticker != "RUB" || output.Items[1].Ticker != "USD" {
		t.Fatalf("unexpected merged items: %+v", output.Items)
	}
	if len(output.Money) != 2 || output.Money[0].Currency != "RUB" || output.Money[1].Currency != "USD" {
		t.Fatalf("unexpected merged money: %+v", output.Money)
	}
}

func TestPlanPerCurrency_ReturnsCallbackError(t *testing.T) {
	input := Input{
		ModeKey: "full",
		Instruments: []InstrumentInfo{
			{Ticker: "AAA", InstrumentID: "AAA", Currency: "RUB"},
		},
	}

	sentinel := errors.New("sentinel")
	_, err := planPerCurrency(input, func(string, Input) (Output, error) {
		return Output{}, sentinel
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected sentinel error, got %v", err)
	}
}

func almostEqual(left, right float64) bool {
	return math.Abs(left-right) < 1e-9
}
