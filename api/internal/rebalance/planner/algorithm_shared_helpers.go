package planner

import (
	"math"
)

type assetState struct {
	key             string
	ticker          string
	instrumentID    string
	currentQuantity float64
	targetWeightRaw float64
	price           float64
	lotSize         int64
}

func buildAssetStates(input Input) map[string]*assetState {
	assets := map[string]*assetState{}

	getOrCreate := func(key string) *assetState {
		if key == "" {
			return nil
		}
		if asset, ok := assets[key]; ok {
			return asset
		}
		asset := &assetState{
			key:             key,
			ticker:          key,
			instrumentID:    "",
			currentQuantity: 0,
			targetWeightRaw: 0,
			price:           0,
			lotSize:         1,
		}
		assets[key] = asset
		return asset
	}

	for _, holding := range input.Holdings {
		key := plannerIdentityKey(holding.Ticker, holding.InstrumentID)
		asset := getOrCreate(key)
		if asset == nil {
			continue
		}
		ticker := normalizedTicker(holding.Ticker, holding.InstrumentID)
		if ticker != "" {
			asset.ticker = ticker
		}
		if trimmed := trimmedOrEmpty(holding.InstrumentID); trimmed != "" {
			asset.instrumentID = trimmed
		}
		asset.currentQuantity += holding.CurrentQuantity
	}

	for _, row := range input.Benchmark {
		key := plannerIdentityKey(row.Ticker, row.InstrumentID)
		asset := getOrCreate(key)
		if asset == nil {
			continue
		}
		ticker := normalizedTicker(row.Ticker, row.InstrumentID)
		if ticker != "" {
			asset.ticker = ticker
		}
		if asset.instrumentID == "" {
			if trimmed := trimmedOrEmpty(row.InstrumentID); trimmed != "" {
				asset.instrumentID = trimmed
			}
		}
		asset.targetWeightRaw += row.TargetWeight
	}

	for _, row := range input.Instruments {
		key := plannerIdentityKey(row.Ticker, row.InstrumentID)
		asset, ok := assets[key]
		if !ok || asset == nil {
			continue
		}
		if row.Price > 0 && asset.price <= 0 {
			asset.price = row.Price
		}
		if asset.instrumentID == "" {
			if trimmed := trimmedOrEmpty(row.InstrumentID); trimmed != "" {
				asset.instrumentID = trimmed
			}
		}
		if asset.ticker == "" {
			asset.ticker = normalizedTicker(row.Ticker, row.InstrumentID)
		}
		if row.LotSize > 0 {
			asset.lotSize = row.LotSize
		}
	}

	return assets
}

func plannerIdentityKey(ticker string, instrumentID string) string {
	if ticker != "" {
		return ticker
	}
	return instrumentID
}

func normalizedTicker(ticker string, instrumentID string) string {
	if ticker != "" {
		return ticker
	}
	return instrumentID
}

func trimmedOrEmpty(value string) string {
	return value
}

func normalizedLotSize(lotSize int64) int64 {
	if lotSize <= 0 {
		return 1
	}
	return lotSize
}

func sumAvailableMoney(rows []Money) float64 {
	total := 0.0
	for _, row := range rows {
		total += row.Available
	}
	return total
}

func rebalanceMoney(rows []Money, currency string, netCash float64) []Money {
	moneyOut := append([]Money(nil), rows...)
	if len(moneyOut) == 0 {
		if currency == "" || math.Abs(netCash) <= 1e-9 {
			return []Money{}
		}
		return []Money{{Currency: currency, Available: round(netCash, 4), Blocked: 0}}
	}

	totalAvailable := 0.0
	for _, row := range moneyOut {
		totalAvailable += row.Available
	}
	newTotal := totalAvailable + netCash

	if math.Abs(totalAvailable) <= 1e-9 {
		moneyOut[0].Available = round(newTotal, 4)
		for i := 1; i < len(moneyOut); i++ {
			moneyOut[i].Available = 0
		}
		return moneyOut
	}

	remaining := newTotal
	for i := range moneyOut {
		if i == len(moneyOut)-1 {
			moneyOut[i].Available = round(remaining, 4)
			continue
		}
		ratio := moneyOut[i].Available / totalAvailable
		updated := round(newTotal*ratio, 4)
		moneyOut[i].Available = updated
		remaining -= updated
	}
	return moneyOut
}
