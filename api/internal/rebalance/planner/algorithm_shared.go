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
	Currency     string
	LotSize      int64
}

type planState struct {
	key                 string
	ticker              string
	instrumentID        string
	currentQuantity     float64
	currentWeight       float64
	targetWeight        float64
	price               float64
	referencePrice      *float64
	currency            string
	lotSize             int64
	currentLots         int64
	remainderQuantity   float64
	desiredTargetLots   int64
	desiredContinuous   float64
	desiredRemainder    float64
	finalTargetLots     int64
	executedDeltaLots   int64
	resolvedReason      string
	resolvedAsUnplanned bool
	currencyKey         string
}

type moneyState struct {
	available map[string]float64
	blocked   map[string]float64
	order     []string
	synthetic bool
}

type buyDemand struct {
	stateIndex    int
	currencyKey   string
	desiredLots   int64
	allocatedLots int64
	lotCost       float64
	targetWeight  float64
	remainder     float64
}

func buildOutput(input Input, targets []BenchmarkConstituent, initialWarnings []string) (Output, error) {
	params := normalizePlanningParams(input.Params)
	holdings := normalizeHoldings(input.Holdings)
	normalizedTargets := normalizeTargets(targets)
	instruments := normalizeInstruments(input.Instruments)

	keys := unionInstrumentKeys(holdings, normalizedTargets)
	warnings := append([]string{}, initialWarnings...)
	currentValues, currentTotalValue := resolveCurrentValues(holdings, instruments)
	money := newMoneyState(input.Money, input.InvestableCapital)
	states := make([]planState, 0, len(keys))
	buyDemands := make([]buyDemand, 0, len(keys))

	for _, key := range keys {
		holding := holdings[key]
		target := normalizedTargets[key]
		instrument := instruments[key]

		currentQuantity := round(holding.CurrentQuantity, params.QuantityPrecision)
		currentWeight := 0.0
		if currentTotalValue > 0 {
			currentWeight = round((currentValues[key]/currentTotalValue)*100, 6)
		}
		targetWeight := round(target.TargetWeight, 6)

		instrumentID := chooseNonEmpty(holding.InstrumentID, target.InstrumentID)
		ticker := chooseNonEmpty(target.Ticker, holding.Ticker)
		if ticker == "" {
			ticker = instrumentID
		}
		lotSize := instrument.LotSize
		if lotSize <= 0 {
			lotSize = 1
		}

		state := planState{
			key:             key,
			ticker:          ticker,
			instrumentID:    instrumentID,
			currentQuantity: currentQuantity,
			currentWeight:   currentWeight,
			targetWeight:    targetWeight,
			price:           instrument.Price,
			currency:        strings.ToUpper(strings.TrimSpace(instrument.Currency)),
			lotSize:         lotSize,
		}
		if state.price > 0 {
			priceCopy := state.price
			state.referencePrice = &priceCopy
		}

		switch {
		case targetWeight > 0 && input.InvestableCapital <= 0:
			state.resolvedReason = "invalid_total_value"
		case (targetWeight > 0 || currentQuantity > 0) && (state.referencePrice == nil || *state.referencePrice <= 0):
			state.resolvedReason = "missing_reference_price"
		default:
			lotQty := float64(lotSize)
			tradableLots := int64(math.Floor((currentQuantity + 1e-9) / lotQty))
			if tradableLots < 0 {
				tradableLots = 0
			}
			state.currentLots = tradableLots
			state.remainderQuantity = round(currentQuantity-(float64(tradableLots)*lotQty), params.QuantityPrecision)

			continuousLots := 0.0
			if targetWeight > 0 && state.price > 0 {
				targetValue := input.InvestableCapital * targetWeight / 100
				continuousQuantity := targetValue / state.price
				continuousLots = continuousQuantity / lotQty
			}
			state.desiredContinuous = continuousLots
			state.desiredRemainder = continuousLots - math.Floor(continuousLots)
			state.desiredTargetLots = int64(math.Round(continuousLots))
			if state.desiredTargetLots < 0 {
				state.desiredTargetLots = 0
			}
			state.finalTargetLots = state.desiredTargetLots
			state.executedDeltaLots = state.finalTargetLots - state.currentLots

			switch {
			case state.executedDeltaLots < 0:
				currencyKey, ok := money.ensureCurrency(state.currency)
				if !ok {
					state.resolvedReason = "missing_money_balance"
				} else {
					state.currencyKey = currencyKey
				}
			case state.executedDeltaLots > 0:
				currencyKey, ok := money.resolveCurrency(state.currency)
				if !ok {
					state.resolvedReason = "missing_money_balance"
				} else {
					state.currencyKey = currencyKey
				}
			default:
				currencyKey, ok := money.resolveCurrency(state.currency)
				if ok {
					state.currencyKey = currencyKey
				}
			}
		}

		if state.resolvedReason != "" {
			warnings = appendUniqueWarning(warnings, state.resolvedReason)
			state.resolvedAsUnplanned = true
			states = append(states, state)
			continue
		}

		if state.executedDeltaLots < 0 {
			// Sells first: increase available money in instrument currency.
			sellLots := -state.executedDeltaLots
			sellAmount := round(float64(sellLots*state.lotSize)*state.price, 2)
			money.addAvailable(state.currencyKey, sellAmount)
		}
		if state.executedDeltaLots > 0 {
			buyDemands = append(buyDemands, buyDemand{
				stateIndex:    len(states),
				currencyKey:   state.currencyKey,
				desiredLots:   state.executedDeltaLots,
				allocatedLots: 0,
				lotCost:       round(float64(state.lotSize)*state.price, 8),
				targetWeight:  state.targetWeight,
				remainder:     state.desiredRemainder,
			})
		}
		states = append(states, state)
	}

	allocateBuyLots(money, states, buyDemands)

	items := make([]Item, 0, len(states))
	for _, state := range states {
		item := Item{
			Ticker:          state.ticker,
			InstrumentID:    state.instrumentID,
			CurrentQuantity: state.currentQuantity,
			CurrentWeight:   state.currentWeight,
			TargetWeight:    state.targetWeight,
			IdealWeight:     state.targetWeight,
			ReferencePrice:  clonePtr(state.referencePrice),
			Metadata:        map[string]interface{}{},
		}
		item.Metadata["lot_size"] = float64(state.lotSize)

		if state.resolvedAsUnplanned {
			item.Status = ItemStatusUnresolved
			item.TargetQuantity = state.currentQuantity
			item.DeltaQuantity = 0
			item.TargetWeight = resolveTargetWeightFromQuantity(
				item.TargetQuantity,
				state.referencePrice,
				input.InvestableCapital,
				state.targetWeight,
			)
			item.Side = chooseSideByWeight(state.currentWeight, state.targetWeight, item.CurrentQuantity, item.TargetQuantity)
			item.Metadata["reason"] = state.resolvedReason
			warnings = appendUniqueWarning(warnings, state.resolvedReason)
			items = append(items, item)
			continue
		}

		targetQuantity := state.remainderQuantity + float64(state.finalTargetLots*state.lotSize)
		targetQuantity = round(targetQuantity, params.QuantityPrecision)
		deltaQuantity := round(targetQuantity-state.currentQuantity, params.QuantityPrecision)

		item.TargetQuantity = targetQuantity
		item.DeltaQuantity = deltaQuantity
		item.TargetWeight = resolveTargetWeightFromQuantity(
			item.TargetQuantity,
			state.referencePrice,
			input.InvestableCapital,
			state.targetWeight,
		)
		item.Side = chooseSide(deltaQuantity, state.currentWeight, state.targetWeight)
		item.Status = ItemStatusPlanned

		if state.referencePrice != nil && *state.referencePrice > 0 {
			executedAmount := round(float64(state.executedDeltaLots*state.lotSize)**state.referencePrice, 2)
			item.PlannedAmount = &executedAmount
		}
		if state.resolvedReason != "" {
			item.Metadata["reason"] = state.resolvedReason
			item.Status = ItemStatusUnresolved
			item.TargetQuantity = state.currentQuantity
			item.DeltaQuantity = 0
			item.TargetWeight = resolveTargetWeightFromQuantity(
				item.TargetQuantity,
				state.referencePrice,
				input.InvestableCapital,
				state.targetWeight,
			)
			item.Side = chooseSideByWeight(state.currentWeight, state.targetWeight, item.CurrentQuantity, item.TargetQuantity)
		}
		if state.desiredTargetLots > state.finalTargetLots {
			item.Metadata["cash_limited"] = true
			item.Metadata["desired_target_quantity"] = round(state.remainderQuantity+float64(state.desiredTargetLots*state.lotSize), params.QuantityPrecision)
			warnings = appendUniqueWarning(warnings, "insufficient_cash")
		}

		items = append(items, item)
	}

	return Output{
		Items:    items,
		Warnings: warnings,
		Money:    money.toOutput(),
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
		instrumentID := strings.TrimSpace(row.InstrumentID)
		if ticker == "" {
			ticker = instrumentID
		}
		if ticker == "" {
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
		ki := instrumentKey(strings.ToUpper(strings.TrimSpace(sorted[i].Ticker)), strings.TrimSpace(sorted[i].InstrumentID))
		kj := instrumentKey(strings.ToUpper(strings.TrimSpace(sorted[j].Ticker)), strings.TrimSpace(sorted[j].InstrumentID))
		return ki < kj
	})

	for _, row := range sorted {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		instrumentID := strings.TrimSpace(row.InstrumentID)
		if ticker == "" {
			ticker = instrumentID
		}
		if ticker == "" {
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

func normalizeInstruments(rows []InstrumentInfo) map[string]normalizedPrice {
	result := make(map[string]normalizedPrice, len(rows))
	for _, row := range rows {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		instrumentID := strings.TrimSpace(row.InstrumentID)
		if ticker == "" {
			ticker = instrumentID
		}
		if ticker == "" || row.Price <= 0 {
			continue
		}

		key := instrumentKey(ticker, instrumentID)
		if _, exists := result[key]; exists {
			continue
		}
		lotSize := row.LotSize
		if lotSize <= 0 {
			lotSize = 1
		}
		result[key] = normalizedPrice{
			Ticker:       ticker,
			InstrumentID: instrumentID,
			Price:        row.Price,
			Currency:     strings.ToUpper(strings.TrimSpace(row.Currency)),
			LotSize:      lotSize,
		}
	}
	return result
}

func resolveCurrentValues(
	holdings map[string]normalizedHolding,
	instruments map[string]normalizedPrice,
) (map[string]float64, float64) {
	values := make(map[string]float64, len(holdings))
	total := 0.0
	for key, holding := range holdings {
		price, ok := instruments[key]
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

func allocateBuyLots(money *moneyState, states []planState, demands []buyDemand) {
	if len(demands) == 0 {
		return
	}

	grouped := map[string][]*buyDemand{}
	for i := range demands {
		demand := &demands[i]
		if demand.desiredLots <= 0 || demand.lotCost <= 0 {
			continue
		}
		grouped[demand.currencyKey] = append(grouped[demand.currencyKey], demand)
	}

	for currency, group := range grouped {
		sort.Slice(group, func(i, j int) bool {
			if group[i].targetWeight != group[j].targetWeight {
				return group[i].targetWeight > group[j].targetWeight
			}
			if group[i].remainder != group[j].remainder {
				return group[i].remainder > group[j].remainder
			}
			left := states[group[i].stateIndex].key
			right := states[group[j].stateIndex].key
			return left < right
		})

		minLotCost := 0.0
		for _, demand := range group {
			if minLotCost == 0 || demand.lotCost < minLotCost {
				minLotCost = demand.lotCost
			}
		}
		if minLotCost <= 0 {
			continue
		}

		const maxIterations = 2000000
		iterations := 0
		for money.availableAmount(currency) >= minLotCost {
			progressed := false
			for _, demand := range group {
				if demand.allocatedLots >= demand.desiredLots {
					continue
				}
				if !money.spendAvailable(currency, demand.lotCost) {
					continue
				}
				demand.allocatedLots++
				progressed = true
			}
			if !progressed {
				break
			}
			iterations++
			if iterations >= maxIterations {
				break
			}
		}
	}

	for _, demand := range demands {
		state := &states[demand.stateIndex]
		state.finalTargetLots = state.currentLots + demand.allocatedLots
		state.executedDeltaLots = demand.allocatedLots
		if demand.allocatedLots < demand.desiredLots {
			if demand.allocatedLots == 0 {
				state.resolvedReason = "insufficient_cash"
				state.resolvedAsUnplanned = true
			}
		}
	}
}

func newMoneyState(input []Money, fallbackCapital float64) *moneyState {
	state := &moneyState{
		available: map[string]float64{},
		blocked:   map[string]float64{},
		order:     make([]string, 0, len(input)),
		synthetic: len(input) == 0,
	}
	seen := map[string]struct{}{}
	for _, row := range input {
		currency := strings.ToUpper(strings.TrimSpace(row.Currency))
		if currency == "" {
			continue
		}
		state.available[currency] += row.Available
		state.blocked[currency] += row.Blocked
		if _, ok := seen[currency]; ok {
			continue
		}
		seen[currency] = struct{}{}
		state.order = append(state.order, currency)
	}

	if len(state.available) == 0 {
		state.available[""] = math.Max(fallbackCapital, 0)
		state.blocked[""] = 0
		state.order = []string{""}
		state.synthetic = true
	}
	return state
}

func (m *moneyState) resolveCurrency(raw string) (string, bool) {
	currency := strings.ToUpper(strings.TrimSpace(raw))
	if currency != "" {
		if _, ok := m.available[currency]; ok {
			return currency, true
		}
		if m.synthetic {
			return "", true
		}
		return "", false
	}
	if m.synthetic {
		return "", true
	}
	if len(m.available) == 1 {
		for key := range m.available {
			return key, true
		}
	}
	return "", false
}

func (m *moneyState) ensureCurrency(raw string) (string, bool) {
	currency := strings.ToUpper(strings.TrimSpace(raw))
	if currency == "" {
		return m.resolveCurrency("")
	}
	if _, ok := m.available[currency]; ok {
		return currency, true
	}
	if m.synthetic {
		return "", true
	}
	m.available[currency] = 0
	m.blocked[currency] = 0
	m.order = append(m.order, currency)
	return currency, true
}

func (m *moneyState) availableAmount(currency string) float64 {
	return m.available[currency]
}

func (m *moneyState) spendAvailable(currency string, amount float64) bool {
	if amount <= 0 {
		return true
	}
	available := m.available[currency]
	if available+1e-9 < amount {
		return false
	}
	m.available[currency] = round(available-amount, 8)
	return true
}

func (m *moneyState) addAvailable(currency string, amount float64) {
	if amount == 0 {
		return
	}
	m.available[currency] = round(m.available[currency]+amount, 8)
}

func (m *moneyState) toOutput() []Money {
	if m.synthetic {
		return []Money{}
	}
	result := make([]Money, 0, len(m.order))
	for _, currency := range m.order {
		if strings.TrimSpace(currency) == "" {
			continue
		}
		result = append(result, Money{
			Currency:  currency,
			Available: round(m.available[currency], 8),
			Blocked:   round(m.blocked[currency], 8),
		})
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
	ticker = strings.ToUpper(strings.TrimSpace(ticker))
	instrumentID = strings.TrimSpace(instrumentID)
	if ticker != "" {
		return ticker
	}
	return instrumentID
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

func resolveTargetWeightFromQuantity(
	targetQuantity float64,
	referencePrice *float64,
	investableCapital float64,
	fallback float64,
) float64 {
	if investableCapital <= 0 || referencePrice == nil || *referencePrice <= 0 {
		return round(fallback, 6)
	}
	targetValue := targetQuantity * *referencePrice
	if targetValue <= 0 {
		return 0
	}
	return round((targetValue/investableCapital)*100, 6)
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

func cloneMoney(rows []Money) []Money {
	if len(rows) == 0 {
		return []Money{}
	}
	out := make([]Money, len(rows))
	copy(out, rows)
	return out
}
