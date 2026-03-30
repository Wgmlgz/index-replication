package planner

import (
	"fmt"
	"time"
)

type PlanningParams struct {
	IncludeZeroDeltas bool
	QuantityPrecision int
	MinDeltaQuantity  float64
}

type Holding struct {
	Ticker          string
	InstrumentID    string
	CurrentQuantity float64
}

type BenchmarkConstituent struct {
	Ticker       string
	InstrumentID string
	TargetWeight float64
}

type Money struct {
	Currency  string
	Available float64
	Blocked   float64
}

type InstrumentInfo struct {
	Ticker       string
	InstrumentID string
	Price        float64
	Currency     string
	AsOfAt       time.Time
	Source       string
	LotSize      int64
}

type Input struct {
	AsOfAt            time.Time
	ModeKey           string
	ModeParams        map[string]interface{}
	InvestableCapital float64
	Holdings          []Holding
	Benchmark         []BenchmarkConstituent
	Instruments       []InstrumentInfo
	Money             []Money
	Params            PlanningParams
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
	IdealWeight     float64
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
	InvestableCapital    float64
}

type Output struct {
	Items    []Item
	Warnings []string
	Money    []Money
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
