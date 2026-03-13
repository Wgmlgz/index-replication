package planner

import "fmt"

type PlanningParams struct {
	IncludeZeroDeltas bool
	QuantityPrecision int
	MinDeltaQuantity  float64
}

type Holding struct {
	Ticker          string
	InstrumentID    string
	CurrentQuantity float64
	CurrentWeight   float64
	ReferencePrice  *float64
}

type BenchmarkConstituent struct {
	Ticker       string
	InstrumentID string
	TargetWeight *float64
}

type Input struct {
	AsOfDate            string
	ModeKey             string
	ModeParams          map[string]interface{}
	TotalPortfolioValue float64
	Holdings            []Holding
	Benchmark           []BenchmarkConstituent
	Params              PlanningParams
}

type Item struct {
	Ticker          string
	InstrumentID    string
	Side            string
	CurrentQuantity float64
	TargetQuantity  float64
	DeltaQuantity   float64
	CurrentWeight   float64
	TargetWeight    float64
	ReferencePrice  *float64
	PlannedAmount   *float64
	Status          string
	Metadata        map[string]interface{}
}

type Summary struct {
	ItemsTotal           int
	ActionableItems      int
	UnresolvedItems      int
	FilteredZeroDelta    int
	EstimatedTurnoverAbs float64
	TotalPortfolioValue  float64
}

type Output struct {
	Items    []Item
	Summary  Summary
	Warnings []string
}

type Algorithm interface {
	Key() string
	Plan(input Input) (Output, error)
}

const (
	ItemSideBuy  = "buy"
	ItemSideSell = "sell"

	ItemStatusPlanned    = "planned"
	ItemStatusUnresolved = "unresolved"
)

var (
	ErrModeNotFound   = fmt.Errorf("planner mode not found")
	ErrInvalidInput   = fmt.Errorf("invalid planning input")
	ErrInvalidModeKey = fmt.Errorf("invalid mode key")
)
