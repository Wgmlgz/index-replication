package planner

import (
	"math"
	"sort"
)

type FullAlgorithm struct{}

func NewFullAlgorithm() *FullAlgorithm {
	return &FullAlgorithm{}
}

func (a *FullAlgorithm) Key() string {
	return "full"
}

func (a *FullAlgorithm) Plan(input Input) (Output, error) {
	return planPerCurrency(input, a.planSingleCurrency)
}

func (a *FullAlgorithm) planSingleCurrency(currency string, input Input) (Output, error) {
	assets := buildAssetStates(input)
	if len(assets) == 0 {
		return Output{
			Items:    []Item{},
			Warnings: []string{},
			Money:    append([]Money(nil), input.Money...),
		}, nil
	}

	precision := input.Params.QuantityPrecision
	if precision < 0 {
		precision = 0
	}

	totalTargetWeight := 0.0
	for _, asset := range assets {
		if asset.targetWeightRaw > 0 {
			totalTargetWeight += asset.targetWeightRaw
		}
	}

	targetDollars := make(map[string]float64, len(assets))
	effectiveBudget := 0.0
	allocatableKeys := make([]string, 0, len(assets))
	for _, asset := range assets {
		if totalTargetWeight > 0 && asset.targetWeightRaw > 0 {
			targetDollars[asset.key] = input.InvestableCapital * (asset.targetWeightRaw / totalTargetWeight)
		} else {
			targetDollars[asset.key] = 0
		}
		if asset.targetWeightRaw > 0 && asset.price > 0 {
			effectiveBudget += targetDollars[asset.key]
			allocatableKeys = append(allocatableKeys, asset.key)
		}
	}
	sort.Strings(allocatableKeys)

	targetQuantityByKey := make(map[string]float64, len(assets))
	spent := 0.0
	minLotCost := math.Inf(1)
	for _, key := range allocatableKeys {
		asset := assets[key]
		lot := normalizedLotSize(asset.lotSize)
		lotCost := asset.price * float64(lot)
		if lotCost < minLotCost {
			minLotCost = lotCost
		}
		dollars := targetDollars[key]
		lots := math.Floor((dollars + 1e-9) / lotCost)
		targetQuantity := lots * float64(lot)
		targetQuantityByKey[key] = targetQuantity
		spent += targetQuantity * asset.price
	}

	remaining := effectiveBudget - spent
	for len(allocatableKeys) > 0 && remaining+1e-9 >= minLotCost {
		bestKey := ""
		bestImprovement := 0.0

		for _, key := range allocatableKeys {
			asset := assets[key]
			lot := normalizedLotSize(asset.lotSize)
			lotCost := asset.price * float64(lot)
			if lotCost > remaining+1e-9 {
				continue
			}

			currentDollars := targetQuantityByKey[key] * asset.price
			nextDollars := (targetQuantityByKey[key] + float64(lot)) * asset.price
			improvement := math.Abs(targetDollars[key]-currentDollars) - math.Abs(targetDollars[key]-nextDollars)

			if improvement > bestImprovement+1e-12 || (math.Abs(improvement-bestImprovement) <= 1e-12 && (bestKey == "" || key < bestKey)) {
				bestImprovement = improvement
				bestKey = key
			}
		}

		if bestKey == "" || bestImprovement <= 1e-12 {
			break
		}

		lot := normalizedLotSize(assets[bestKey].lotSize)
		lotCost := assets[bestKey].price * float64(lot)
		targetQuantityByKey[bestKey] += float64(lot)
		spent += lotCost
		remaining = effectiveBudget - spent
	}

	plannedDeltas := make(map[string]float64, len(assets))
	for _, asset := range assets {
		targetQuantity := targetQuantityByKey[asset.key]
		if asset.price <= 0 && asset.targetWeightRaw > 0 {
			targetQuantity = round(asset.currentQuantity, precision)
		}
		targetQuantity = round(targetQuantity, precision)
		plannedDeltas[asset.key] = round(targetQuantity-asset.currentQuantity, precision)
	}

	initialCash := sumAvailableMoney(input.Money)
	totalSellProceeds := 0.0
	for _, asset := range assets {
		delta := plannedDeltas[asset.key]
		if asset.price > 0 && delta < 0 {
			totalSellProceeds += (-delta) * asset.price
		}
	}
	remainingCash := initialCash + totalSellProceeds

	buyKeys := make([]string, 0, len(assets))
	for _, asset := range assets {
		if plannedDeltas[asset.key] > 0 {
			buyKeys = append(buyKeys, asset.key)
		}
	}
	sort.SliceStable(buyKeys, func(i, j int) bool {
		left := assets[buyKeys[i]]
		right := assets[buyKeys[j]]
		if left.targetWeightRaw != right.targetWeightRaw {
			return left.targetWeightRaw > right.targetWeightRaw
		}
		return left.key < right.key
	})

	unresolvedInsufficientCash := map[string]bool{}
	for _, key := range buyKeys {
		asset := assets[key]
		if asset.price <= 0 {
			continue
		}
		buyCost := plannedDeltas[key] * asset.price
		if buyCost <= remainingCash+1e-9 {
			remainingCash -= buyCost
			continue
		}
		unresolvedInsufficientCash[key] = true
	}

	keys := make([]string, 0, len(assets))
	for key := range assets {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	items := make([]Item, 0, len(keys))
	plannedNetCash := 0.0
	for _, key := range keys {
		asset := assets[key]
		targetQuantity := round(asset.currentQuantity+plannedDeltas[key], precision)
		deltaQuantity := plannedDeltas[key]

		status := ItemStatusPlanned
		metadata := map[string]interface{}{}

		if asset.targetWeightRaw > 0 && asset.price <= 0 {
			status = ItemStatusUnresolved
			metadata["reason"] = "missing_reference_price"
		} else if unresolvedInsufficientCash[key] {
			status = ItemStatusUnresolved
			metadata["reason"] = "insufficient_cash"
		}

		currentWeight := 0.0
		targetWeight := asset.targetWeightRaw
		if input.InvestableCapital > 0 && asset.price > 0 {
			currentWeight = (asset.currentQuantity * asset.price / input.InvestableCapital) * 100
			targetWeight = (targetQuantity * asset.price / input.InvestableCapital) * 100
		}
		idealWeight := asset.targetWeightRaw

		side := ItemSideBuy
		if deltaQuantity < 0 {
			side = ItemSideSell
		}

		var referencePrice *float64
		if asset.price > 0 {
			price := round(asset.price, 8)
			referencePrice = &price
		}

		var plannedAmount *float64
		if status == ItemStatusPlanned && asset.price > 0 {
			amount := round(deltaQuantity*asset.price, 4)
			plannedAmount = &amount
			plannedNetCash -= amount
		}

		items = append(items, Item{
			Ticker:          asset.ticker,
			InstrumentID:    resolveAssetInstrumentID(asset),
			Side:            side,
			CurrentQuantity: round(asset.currentQuantity, precision),
			TargetQuantity:  targetQuantity,
			DeltaQuantity:   deltaQuantity,
			CurrentWeight:   round(currentWeight, 6),
			TargetWeight:    round(targetWeight, 6),
			IdealWeight:     round(idealWeight, 6),
			ReferencePrice:  referencePrice,
			PlannedAmount:   plannedAmount,
			Status:          status,
			Metadata:        metadata,
		})
	}

	moneyOut := rebalanceMoney(input.Money, currency, plannedNetCash)

	return Output{
		Items:    items,
		Warnings: []string{},
		Money:    moneyOut,
	}, nil
}
