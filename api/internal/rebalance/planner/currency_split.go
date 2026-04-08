package planner

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

const unknownCurrencyBucket = "__unknown_currency__"

type currencyScopedInput struct {
	Currency string
	Input    Input
}

type currencyInputBucket struct {
	currency string
	input    Input
}

func splitInputByCurrency(input Input) []currencyScopedInput {
	currencyByInstrumentID := make(map[string]string, len(input.Instruments))
	currencyByTicker := make(map[string]string, len(input.Instruments))
	priceByInstrumentID := make(map[string]float64, len(input.Instruments))
	priceByTicker := make(map[string]float64, len(input.Instruments))

	buckets := map[string]*currencyInputBucket{}
	getBucket := func(currency string) *currencyInputBucket {
		key := currencyBucketKey(currency)
		bucket := buckets[key]
		if bucket != nil {
			return bucket
		}
		bucket = &currencyInputBucket{
			currency: normalizeCurrency(currency),
			input: Input{
				AsOfAt:      input.AsOfAt,
				ModeKey:     input.ModeKey,
				ModeParams:  cloneModeParams(input.ModeParams),
				Params:      input.Params,
				Holdings:    []Holding{},
				Benchmark:   []BenchmarkConstituent{},
				Instruments: []InstrumentInfo{},
				Money:       []Money{},
			},
		}
		buckets[key] = bucket
		return bucket
	}

	for _, instrument := range input.Instruments {
		currency := normalizeCurrency(instrument.Currency)
		bucket := getBucket(currency)
		bucket.input.Instruments = append(bucket.input.Instruments, instrument)

		instrumentIDKey := normalizeIdentity(instrument.InstrumentID)
		if instrumentIDKey != "" && currency != "" {
			if _, exists := currencyByInstrumentID[instrumentIDKey]; !exists {
				currencyByInstrumentID[instrumentIDKey] = currency
			}
			if _, exists := priceByInstrumentID[instrumentIDKey]; !exists && instrument.Price > 0 {
				priceByInstrumentID[instrumentIDKey] = instrument.Price
			}
		}

		tickerKey := normalizeIdentity(instrument.Ticker)
		if tickerKey != "" && currency != "" {
			if _, exists := currencyByTicker[tickerKey]; !exists {
				currencyByTicker[tickerKey] = currency
			}
			if _, exists := priceByTicker[tickerKey]; !exists && instrument.Price > 0 {
				priceByTicker[tickerKey] = instrument.Price
			}
		}
	}

	for _, row := range input.Money {
		currency := normalizeCurrency(row.Currency)
		bucket := getBucket(currency)
		bucket.input.Money = append(bucket.input.Money, row)
	}

	for _, holding := range input.Holdings {
		currency := resolveCurrencyForIdentity(holding.InstrumentID, holding.Ticker, currencyByInstrumentID, currencyByTicker)
		getBucket(currency).input.Holdings = append(getBucket(currency).input.Holdings, holding)
	}

	for _, constituent := range input.Benchmark {
		currency := resolveCurrencyForIdentity(constituent.InstrumentID, constituent.Ticker, currencyByInstrumentID, currencyByTicker)
		getBucket(currency).input.Benchmark = append(getBucket(currency).input.Benchmark, constituent)
	}

	if len(buckets) == 0 {
		defaultBucket := getBucket("")
		defaultBucket.input.InvestableCapital = input.InvestableCapital
		return []currencyScopedInput{{Currency: defaultBucket.currency, Input: defaultBucket.input}}
	}

	assignInvestableCapital(input, buckets, currencyByInstrumentID, currencyByTicker, priceByInstrumentID, priceByTicker)

	keys := make([]string, 0, len(buckets))
	for key := range buckets {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		left := buckets[keys[i]].currency
		right := buckets[keys[j]].currency
		if left == "" && right != "" {
			return false
		}
		if left != "" && right == "" {
			return true
		}
		return left < right
	})

	result := make([]currencyScopedInput, 0, len(keys))
	for _, key := range keys {
		bucket := buckets[key]
		result = append(result, currencyScopedInput{
			Currency: bucket.currency,
			Input:    bucket.input,
		})
	}
	return result
}

func planPerCurrency(input Input, planner func(currency string, scopedInput Input) (Output, error)) (Output, error) {
	if planner == nil {
		return Output{}, fmt.Errorf("%w: per-currency planner is nil", ErrInvalidInput)
	}

	scopedInputs := splitInputByCurrency(input)
	merged := Output{
		Items:    []Item{},
		Warnings: []string{},
		Money:    []Money{},
	}
	for _, scoped := range scopedInputs {
		output, err := planner(scoped.Currency, scoped.Input)
		if err != nil {
			return Output{}, err
		}
		merged.Items = append(merged.Items, output.Items...)
		merged.Warnings = append(merged.Warnings, output.Warnings...)
		merged.Money = append(merged.Money, output.Money...)
	}
	return merged, nil
}

func assignInvestableCapital(
	input Input,
	buckets map[string]*currencyInputBucket,
	currencyByInstrumentID map[string]string,
	currencyByTicker map[string]string,
	priceByInstrumentID map[string]float64,
	priceByTicker map[string]float64,
) {
	if len(buckets) == 1 {
		for _, bucket := range buckets {
			bucket.input.InvestableCapital = input.InvestableCapital
		}
		return
	}
	if input.InvestableCapital == 0 {
		for _, bucket := range buckets {
			bucket.input.InvestableCapital = 0
		}
		return
	}

	weightByBucket := make(map[string]float64, len(buckets))
	totalWeight := 0.0

	for _, constituent := range input.Benchmark {
		if constituent.TargetWeight <= 0 {
			continue
		}
		currency := resolveCurrencyForIdentity(constituent.InstrumentID, constituent.Ticker, currencyByInstrumentID, currencyByTicker)
		key := currencyBucketKey(currency)
		weightByBucket[key] += constituent.TargetWeight
		totalWeight += constituent.TargetWeight
	}

	if totalWeight == 0 {
		for _, holding := range input.Holdings {
			price := resolvePriceForIdentity(holding.InstrumentID, holding.Ticker, priceByInstrumentID, priceByTicker)
			if price <= 0 {
				continue
			}
			positionValue := holding.CurrentQuantity * price
			if positionValue <= 0 {
				continue
			}
			currency := resolveCurrencyForIdentity(holding.InstrumentID, holding.Ticker, currencyByInstrumentID, currencyByTicker)
			key := currencyBucketKey(currency)
			weightByBucket[key] += positionValue
			totalWeight += positionValue
		}
	}

	if totalWeight == 0 {
		for _, row := range input.Money {
			cashValue := row.Available + row.Blocked
			if cashValue <= 0 {
				continue
			}
			key := currencyBucketKey(normalizeCurrency(row.Currency))
			weightByBucket[key] += cashValue
			totalWeight += cashValue
		}
	}

	if totalWeight == 0 {
		equalShare := input.InvestableCapital / float64(len(buckets))
		for _, bucket := range buckets {
			bucket.input.InvestableCapital = equalShare
		}
		return
	}

	for key, bucket := range buckets {
		bucket.input.InvestableCapital = input.InvestableCapital * (weightByBucket[key] / totalWeight)
		if math.Abs(bucket.input.InvestableCapital) < 1e-12 {
			bucket.input.InvestableCapital = 0
		}
	}
}

func resolveCurrencyForIdentity(
	instrumentID string,
	ticker string,
	currencyByInstrumentID map[string]string,
	currencyByTicker map[string]string,
) string {
	instrumentIDKey := normalizeIdentity(instrumentID)
	if instrumentIDKey != "" {
		if currency, ok := currencyByInstrumentID[instrumentIDKey]; ok {
			return currency
		}
	}
	tickerKey := normalizeIdentity(ticker)
	if tickerKey != "" {
		if currency, ok := currencyByTicker[tickerKey]; ok {
			return currency
		}
	}
	return ""
}

func resolvePriceForIdentity(
	instrumentID string,
	ticker string,
	priceByInstrumentID map[string]float64,
	priceByTicker map[string]float64,
) float64 {
	instrumentIDKey := normalizeIdentity(instrumentID)
	if instrumentIDKey != "" {
		if price, ok := priceByInstrumentID[instrumentIDKey]; ok {
			return price
		}
	}
	tickerKey := normalizeIdentity(ticker)
	if tickerKey != "" {
		if price, ok := priceByTicker[tickerKey]; ok {
			return price
		}
	}
	return 0
}

func currencyBucketKey(currency string) string {
	normalized := normalizeCurrency(currency)
	if normalized == "" {
		return unknownCurrencyBucket
	}
	return normalized
}

func normalizeIdentity(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeCurrency(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func cloneModeParams(value map[string]interface{}) map[string]interface{} {
	if len(value) == 0 {
		return map[string]interface{}{}
	}
	cloned := make(map[string]interface{}, len(value))
	for key, row := range value {
		cloned[key] = row
	}
	return cloned
}
