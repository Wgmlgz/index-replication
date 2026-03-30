package planner

import (
	"math"
	"sort"
	"strings"
)

type normalizedHolding struct {
	Ticker          string
	InstrumentID    string
	CurrentQuantity float64
}

type normalizedTarget struct {
	Ticker       string
	InstrumentID string
	TargetWeight float64
}

type normalizedPrice struct {
	Ticker       string
	InstrumentID string
	Price        float64
}

func buildOutput(input Input, targets []BenchmarkConstituent, initialWarnings []string) (Output, error) {
	params := normalizePlanningParams(input.Params)
	holdings := normalizeHoldings(input.Holdings)
	normalizedTargets := normalizeTargets(targets)
	prices := normalizePrices(input.Prices)

	keys := unionInstrumentKeys(holdings, normalizedTargets)
	items := make([]Item, 0, len(keys))
	warnings := append([]string{}, initialWarnings...)
	currentValues, currentTotalValue := resolveCurrentValues(holdings, prices)

	for _, key := range keys {
		holding := holdings[key]
		target := normalizedTargets[key]
		price := prices[key]

		currentQuantity := round(holding.CurrentQuantity, params.QuantityPrecision)
		currentWeight := 0.0
		if currentTotalValue > 0 {
			currentWeight = round((currentValues[key]/currentTotalValue)*100, 6)
		}
		targetWeight := round(target.TargetWeight, 6)

		instrumentID := chooseNonEmpty(target.InstrumentID, holding.InstrumentID)
		ticker := chooseNonEmpty(target.Ticker, holding.Ticker)
		if ticker == "" {
			ticker = instrumentID
		}
		var referencePrice *float64
		if price.Price > 0 {
			copy := price.Price
			referencePrice = &copy
		}

		item := Item{
			Ticker:          ticker,
			InstrumentID:    instrumentID,
			CurrentQuantity: currentQuantity,
			CurrentWeight:   currentWeight,
			TargetWeight:    targetWeight,
			ReferencePrice:  referencePrice,
			Metadata:        map[string]interface{}{},
		}

		reason := ""
		targetQuantity := 0.0
		if targetWeight > 0 {
			switch {
			case input.InvestableCapital <= 0:
				reason = "invalid_total_value"
			case referencePrice == nil || *referencePrice <= 0:
				reason = "missing_reference_price"
			default:
				targetValue := input.InvestableCapital * targetWeight / 100
				targetQuantity = targetValue / *referencePrice
				item.Metadata["target_value"] = round(targetValue, 2)
			}
		}

		if reason != "" {
			item.Status = ItemStatusUnresolved
			item.TargetQuantity = currentQuantity
			item.DeltaQuantity = 0
			item.Side = chooseSideByWeight(currentWeight, targetWeight, currentQuantity, item.TargetQuantity)
			item.Metadata["reason"] = reason
			warnings = appendUniqueWarning(warnings, reason)
			items = append(items, item)
			continue
		}

		item.TargetQuantity = round(targetQuantity, params.QuantityPrecision)
		item.DeltaQuantity = round(item.TargetQuantity-currentQuantity, params.QuantityPrecision)
		item.Side = chooseSide(item.DeltaQuantity, currentWeight, targetWeight)
		item.Status = ItemStatusPlanned

		if referencePrice != nil && *referencePrice > 0 {
			plannedAmount := round(item.DeltaQuantity**referencePrice, 2)
			item.PlannedAmount = &plannedAmount
		}

		if math.Abs(item.DeltaQuantity) <= params.MinDeltaQuantity && !params.IncludeZeroDeltas {
			continue
		}

		items = append(items, item)
	}

	return Output{
		Items:    items,
		Warnings: warnings,
	}, nil
}

func normalizePlanningParams(input PlanningParams) PlanningParams {
	result := input
	if result.QuantityPrecision <= 0 {
		result.QuantityPrecision = 6
	}
	if result.QuantityPrecision > 8 {
		result.QuantityPrecision = 8
	}
	if result.MinDeltaQuantity <= 0 {
		result.MinDeltaQuantity = 1e-6
	}
	return result
}

func normalizeHoldings(rows []Holding) map[string]normalizedHolding {
	result := make(map[string]normalizedHolding, len(rows))
	for _, row := range rows {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		instrumentID := strings.ToUpper(strings.TrimSpace(row.InstrumentID))
		if instrumentID == "" {
			instrumentID = ticker
		}
		if ticker == "" {
			ticker = instrumentID
		}
		if instrumentID == "" {
			continue
		}

		key := instrumentKey(ticker, instrumentID)
		existing, ok := result[key]
		if !ok {
			result[key] = normalizedHolding{
				Ticker:          ticker,
				InstrumentID:    instrumentID,
				CurrentQuantity: row.CurrentQuantity,
			}
			continue
		}

		existing.CurrentQuantity += row.CurrentQuantity
		result[key] = existing
	}

	for key, row := range result {
		row.CurrentQuantity = round(row.CurrentQuantity, 8)
		result[key] = row
	}
	return result
}

func normalizeTargets(rows []BenchmarkConstituent) map[string]normalizedTarget {
	result := make(map[string]normalizedTarget, len(rows))

	sorted := make([]BenchmarkConstituent, 0, len(rows))
	sorted = append(sorted, rows...)
	sort.Slice(sorted, func(i, j int) bool {
		ki := instrumentKey(strings.ToUpper(strings.TrimSpace(sorted[i].Ticker)), strings.ToUpper(strings.TrimSpace(sorted[i].InstrumentID)))
		kj := instrumentKey(strings.ToUpper(strings.TrimSpace(sorted[j].Ticker)), strings.ToUpper(strings.TrimSpace(sorted[j].InstrumentID)))
		return ki < kj
	})

	for _, row := range sorted {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		instrumentID := strings.ToUpper(strings.TrimSpace(row.InstrumentID))
		if instrumentID == "" {
			instrumentID = ticker
		}
		if ticker == "" {
			ticker = instrumentID
		}
		if instrumentID == "" {
			continue
		}

		key := instrumentKey(ticker, instrumentID)
		existing, ok := result[key]
		if !ok {
			result[key] = normalizedTarget{
				Ticker:       ticker,
				InstrumentID: instrumentID,
				TargetWeight: row.TargetWeight,
			}
			continue
		}

		existing.TargetWeight += row.TargetWeight
		result[key] = existing
	}

	for key, row := range result {
		row.TargetWeight = round(row.TargetWeight, 6)
		result[key] = row
	}
	return result
}

func normalizePrices(rows []InstrumentPrice) map[string]normalizedPrice {
	result := make(map[string]normalizedPrice, len(rows))
	for _, row := range rows {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		instrumentID := strings.ToUpper(strings.TrimSpace(row.InstrumentID))
		if instrumentID == "" {
			instrumentID = ticker
		}
		if ticker == "" {
			ticker = instrumentID
		}
		if instrumentID == "" || row.Price <= 0 {
			continue
		}

		key := instrumentKey(ticker, instrumentID)
		if _, exists := result[key]; exists {
			continue
		}
		result[key] = normalizedPrice{
			Ticker:       ticker,
			InstrumentID: instrumentID,
			Price:        row.Price,
		}
	}
	return result
}

func resolveCurrentValues(
	holdings map[string]normalizedHolding,
	prices map[string]normalizedPrice,
) (map[string]float64, float64) {
	values := make(map[string]float64, len(holdings))
	total := 0.0
	for key, holding := range holdings {
		price, ok := prices[key]
		if !ok || price.Price <= 0 {
			continue
		}
		value := round(holding.CurrentQuantity*price.Price, 8)
		if value <= 0 {
			continue
		}
		values[key] = value
		total += value
	}
	return values, round(total, 8)
}

func unionInstrumentKeys(holdings map[string]normalizedHolding, targets map[string]normalizedTarget) []string {
	keys := make([]string, 0, len(holdings)+len(targets))
	seen := make(map[string]struct{}, len(holdings)+len(targets))

	for key := range holdings {
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		keys = append(keys, key)
	}
	for key := range targets {
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func instrumentKey(ticker, instrumentID string) string {
	if instrumentID == "" {
		instrumentID = ticker
	}
	if ticker == "" {
		ticker = instrumentID
	}
	return ticker + "::" + instrumentID
}

func chooseSide(delta, currentWeight, targetWeight float64) string {
	if delta < 0 {
		return ItemSideSell
	}
	if delta > 0 {
		return ItemSideBuy
	}
	if targetWeight < currentWeight {
		return ItemSideSell
	}
	return ItemSideBuy
}

func chooseSideByWeight(currentWeight, targetWeight, currentQuantity, targetQuantity float64) string {
	if targetWeight < currentWeight {
		return ItemSideSell
	}
	if targetWeight > currentWeight {
		return ItemSideBuy
	}
	if targetQuantity < currentQuantity {
		return ItemSideSell
	}
	return ItemSideBuy
}

func chooseNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func appendUniqueWarning(warnings []string, warning string) []string {
	warning = strings.TrimSpace(warning)
	if warning == "" {
		return warnings
	}
	for _, current := range warnings {
		if current == warning {
			return warnings
		}
	}
	return append(warnings, warning)
}

func round(value float64, precision int) float64 {
	if precision < 0 {
		precision = 0
	}
	factor := math.Pow10(precision)
	return math.Round(value*factor) / factor
}

func clonePtr(value *float64) *float64 {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
