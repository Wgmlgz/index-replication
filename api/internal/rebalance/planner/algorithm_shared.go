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
	CurrentWeight   float64
	ReferencePrice  *float64
}

type normalizedTarget struct {
	Ticker       string
	InstrumentID string
	TargetWeight *float64
}

func buildOutput(input Input, targets []BenchmarkConstituent, initialWarnings []string) (Output, error) {
	params := normalizePlanningParams(input.Params)
	holdings := normalizeHoldings(input.Holdings)
	normalizedTargets := normalizeTargets(targets)

	keys := unionInstrumentKeys(holdings, normalizedTargets)
	items := make([]Item, 0, len(keys))
	warnings := append([]string{}, initialWarnings...)
	summary := Summary{TotalPortfolioValue: round(input.TotalPortfolioValue, 4)}

	for _, key := range keys {
		holding := holdings[key]
		target := normalizedTargets[key]

		currentQuantity := round(holding.CurrentQuantity, params.QuantityPrecision)
		currentWeight := round(holding.CurrentWeight, 6)

		targetWeight := 0.0
		hasTargetWeight := true
		if target.TargetWeight == nil {
			hasTargetWeight = false
		} else {
			targetWeight = round(*target.TargetWeight, 6)
		}

		instrumentID := chooseNonEmpty(target.InstrumentID, holding.InstrumentID)
		ticker := chooseNonEmpty(target.Ticker, holding.Ticker)
		if ticker == "" {
			ticker = instrumentID
		}

		item := Item{
			Ticker:          ticker,
			InstrumentID:    instrumentID,
			CurrentQuantity: currentQuantity,
			CurrentWeight:   currentWeight,
			TargetWeight:    targetWeight,
			ReferencePrice:  holding.ReferencePrice,
			Metadata:        map[string]interface{}{},
		}

		reason := ""
		if !hasTargetWeight {
			reason = "missing_target_weight"
			item.TargetWeight = 0
		}

		targetQuantity := 0.0
		if reason == "" {
			switch {
			case targetWeight == 0:
				targetQuantity = 0
			case input.TotalPortfolioValue <= 0:
				reason = "invalid_total_value"
			case holding.ReferencePrice == nil || *holding.ReferencePrice <= 0:
				reason = "missing_reference_price"
			default:
				targetValue := input.TotalPortfolioValue * targetWeight / 100
				targetQuantity = targetValue / *holding.ReferencePrice
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
			summary.UnresolvedItems++
			items = append(items, item)
			continue
		}

		item.TargetQuantity = round(targetQuantity, params.QuantityPrecision)
		item.DeltaQuantity = round(item.TargetQuantity-currentQuantity, params.QuantityPrecision)
		item.Side = chooseSide(item.DeltaQuantity, currentWeight, targetWeight)
		item.Status = ItemStatusPlanned

		if holding.ReferencePrice != nil && *holding.ReferencePrice > 0 {
			plannedAmount := round(item.DeltaQuantity**holding.ReferencePrice, 2)
			item.PlannedAmount = &plannedAmount
			summary.EstimatedTurnoverAbs = round(summary.EstimatedTurnoverAbs+math.Abs(plannedAmount), 2)
		}

		if math.Abs(item.DeltaQuantity) <= params.MinDeltaQuantity && !params.IncludeZeroDeltas {
			summary.FilteredZeroDelta++
			continue
		}

		summary.ActionableItems++
		items = append(items, item)
	}

	summary.ItemsTotal = len(items)
	return Output{
		Items:    items,
		Summary:  summary,
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
				CurrentWeight:   row.CurrentWeight,
				ReferencePrice:  clonePtr(row.ReferencePrice),
			}
			continue
		}

		existing.CurrentQuantity += row.CurrentQuantity
		existing.CurrentWeight += row.CurrentWeight
		if existing.ReferencePrice == nil && row.ReferencePrice != nil {
			existing.ReferencePrice = clonePtr(row.ReferencePrice)
		}
		result[key] = existing
	}

	for key, row := range result {
		row.CurrentQuantity = round(row.CurrentQuantity, 8)
		row.CurrentWeight = round(row.CurrentWeight, 6)
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
				TargetWeight: clonePtr(row.TargetWeight),
			}
			continue
		}

		switch {
		case existing.TargetWeight == nil && row.TargetWeight != nil:
			existing.TargetWeight = clonePtr(row.TargetWeight)
		case existing.TargetWeight != nil && row.TargetWeight != nil:
			combined := *existing.TargetWeight + *row.TargetWeight
			existing.TargetWeight = &combined
		}
		result[key] = existing
	}

	for key, row := range result {
		if row.TargetWeight != nil {
			value := round(*row.TargetWeight, 6)
			row.TargetWeight = &value
		}
		result[key] = row
	}
	return result
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
