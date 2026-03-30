package rebalance

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/rebalance/planner"

	"gorm.io/datatypes"
)

func toPlanInputDTO(input planner.Input) dto.PortfolioRebalanceInput {
	modeParams := map[string]interface{}{}
	for key, value := range input.ModeParams {
		modeParams[key] = value
	}

	holdings := make([]dto.PortfolioRebalanceHolding, 0, len(input.Holdings))
	for _, row := range input.Holdings {
		holdings = append(holdings, dto.PortfolioRebalanceHolding{
			Ticker:          row.Ticker,
			InstrumentID:    row.InstrumentID,
			CurrentQuantity: row.CurrentQuantity,
		})
	}

	benchmark := make([]dto.PortfolioRebalanceBenchmarkConstituent, 0, len(input.Benchmark))
	for _, row := range input.Benchmark {
		benchmark = append(benchmark, dto.PortfolioRebalanceBenchmarkConstituent{
			Ticker:       row.Ticker,
			InstrumentID: row.InstrumentID,
			TargetWeight: row.TargetWeight,
		})
	}

	instruments := make([]dto.PortfolioRebalanceInstrumentInfo, 0, len(input.Instruments))
	for _, row := range input.Instruments {
		instruments = append(instruments, dto.PortfolioRebalanceInstrumentInfo{
			Ticker:       row.Ticker,
			InstrumentID: row.InstrumentID,
			Price:        row.Price,
			Currency:     row.Currency,
			AsOfAt:       row.AsOfAt,
			Source:       row.Source,
			LotSize:      row.LotSize,
		})
	}

	money := make([]dto.PortfolioRebalanceMoney, 0, len(input.Money))
	for _, row := range input.Money {
		money = append(money, dto.PortfolioRebalanceMoney{
			Currency:  row.Currency,
			Available: row.Available,
			Blocked:   row.Blocked,
		})
	}

	return dto.PortfolioRebalanceInput{
		AsOfAt:            input.AsOfAt,
		ModeKey:           input.ModeKey,
		ModeParams:        modeParams,
		InvestableCapital: input.InvestableCapital,
		Holdings:          holdings,
		Benchmark:         benchmark,
		Instruments:       instruments,
		Money:             money,
		Params: dto.PortfolioRebalancePlanningParams{
			QuantityPrecision: input.Params.QuantityPrecision,
			MinDeltaQuantity:  input.Params.MinDeltaQuantity,
		},
	}
}

func toPlanOutputDTO(output planner.Output) dto.PortfolioRebalanceOutput {
	items := make([]dto.PortfolioRebalanceItem, 0, len(output.Items))
	for _, row := range output.Items {
		metadata := map[string]interface{}{}
		for key, value := range row.Metadata {
			metadata[key] = value
		}
		items = append(items, dto.PortfolioRebalanceItem{
			Ticker:          row.Ticker,
			InstrumentID:    row.InstrumentID,
			Side:            row.Side,
			CurrentQuantity: row.CurrentQuantity,
			TargetQuantity:  row.TargetQuantity,
			DeltaQuantity:   row.DeltaQuantity,
			CurrentWeight:   row.CurrentWeight,
			TargetWeight:    row.TargetWeight,
			IdealWeight:     row.IdealWeight,
			ReferencePrice:  cloneFloatPtr(row.ReferencePrice),
			PlannedAmount:   cloneFloatPtr(row.PlannedAmount),
			Status:          row.Status,
			Metadata:        metadata,
		})
	}

	money := make([]dto.PortfolioRebalanceMoney, 0, len(output.Money))
	for _, row := range output.Money {
		money = append(money, dto.PortfolioRebalanceMoney{
			Currency:  row.Currency,
			Available: row.Available,
			Blocked:   row.Blocked,
		})
	}

	warnings := make([]string, len(output.Warnings))
	copy(warnings, output.Warnings)

	return dto.PortfolioRebalanceOutput{
		Items:    items,
		Warnings: warnings,
		Money:    money,
	}
}

func toPlanSummaryDTO(summary planner.Summary) dto.PortfolioRebalanceSummary {
	return dto.PortfolioRebalanceSummary{
		ItemsTotal:           summary.ItemsTotal,
		ActionableItems:      summary.ActionableItems,
		UnresolvedItems:      summary.UnresolvedItems,
		FilteredZeroDelta:    summary.FilteredZeroDelta,
		EstimatedTurnoverAbs: summary.EstimatedTurnoverAbs,
		InvestableCapital:    summary.InvestableCapital,
	}
}

func toDetailDTO(model *models.PortfolioRebalanceRun) (*dto.PortfolioRebalanceDetailResponse, error) {
	if model == nil {
		return nil, fmt.Errorf("rebalance run is nil")
	}

	input := dto.PortfolioRebalanceInput{
		ModeParams:  map[string]interface{}{},
		Holdings:    []dto.PortfolioRebalanceHolding{},
		Benchmark:   []dto.PortfolioRebalanceBenchmarkConstituent{},
		Instruments: []dto.PortfolioRebalanceInstrumentInfo{},
		Money:       []dto.PortfolioRebalanceMoney{},
	}
	output := dto.PortfolioRebalanceOutput{
		Items:    []dto.PortfolioRebalanceItem{},
		Warnings: []string{},
		Money:    []dto.PortfolioRebalanceMoney{},
	}
	summary := dto.PortfolioRebalanceSummary{}

	if len(model.InputJSON) > 0 {
		if err := decodeJSONPayloadMap(model.InputJSON, &input); err != nil {
			return nil, fmt.Errorf("decode run input payload: %w", err)
		}
	}

	if len(model.OutputJSON) > 0 {
		if err := decodeJSONPayloadMap(model.OutputJSON, &output); err != nil {
			return nil, fmt.Errorf("decode run output payload: %w", err)
		}
	}
	if len(output.Warnings) == 0 && len(model.WarningsJSON) > 0 {
		_ = json.Unmarshal(model.WarningsJSON, &output.Warnings)
	}
	if output.Warnings == nil {
		output.Warnings = []string{}
	}
	if output.Items == nil {
		output.Items = []dto.PortfolioRebalanceItem{}
	}
	if output.Money == nil {
		output.Money = []dto.PortfolioRebalanceMoney{}
	}

	if len(model.SummaryJSON) > 0 {
		if err := decodeRebalanceSummary(model.SummaryJSON, &summary); err != nil {
			return nil, fmt.Errorf("decode run summary payload: %w", err)
		}
	}
	transactions := buildExecutionTransactions(input, output)

	return &dto.PortfolioRebalanceDetailResponse{
		Run:          toRunDTO(model),
		Input:        input,
		Output:       output,
		Summary:      summary,
		Transactions: transactions,
	}, nil
}

func buildExecutionTransactions(
	input dto.PortfolioRebalanceInput,
	output dto.PortfolioRebalanceOutput,
) []dto.PortfolioRebalanceTransaction {
	if len(output.Items) == 0 {
		return []dto.PortfolioRebalanceTransaction{}
	}

	instrumentInfoByKey := map[string]dto.PortfolioRebalanceInstrumentInfo{}
	for _, row := range input.Instruments {
		key := transactionInstrumentKey(row.Ticker, row.InstrumentID)
		if key == "" {
			continue
		}
		instrumentInfoByKey[key] = row
	}

	result := make([]dto.PortfolioRebalanceTransaction, 0, len(output.Items))
	for _, item := range output.Items {
		if item.Status != planner.ItemStatusPlanned {
			continue
		}
		quantity := math.Abs(item.DeltaQuantity)
		if quantity <= 0 {
			continue
		}

		side := strings.ToLower(strings.TrimSpace(item.Side))
		if side != planner.ItemSideBuy && side != planner.ItemSideSell {
			if item.DeltaQuantity < 0 {
				side = planner.ItemSideSell
			} else {
				side = planner.ItemSideBuy
			}
		}

		info := instrumentInfoByKey[transactionInstrumentKey(item.Ticker, item.InstrumentID)]
		amount := cloneFloatPtr(item.PlannedAmount)
		if amount != nil {
			*amount = math.Abs(*amount)
		}

		result = append(result, dto.PortfolioRebalanceTransaction{
			Ticker:       item.Ticker,
			InstrumentID: item.InstrumentID,
			Side:         side,
			Quantity:     quantity,
			Price:        cloneFloatPtr(item.ReferencePrice),
			Amount:       amount,
			Currency:     info.Currency,
			LotSize:      info.LotSize,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		left := result[i]
		right := result[j]
		leftWeight := transactionSideWeight(left.Side)
		rightWeight := transactionSideWeight(right.Side)
		if leftWeight != rightWeight {
			return leftWeight < rightWeight
		}
		if left.Currency != right.Currency {
			return left.Currency < right.Currency
		}
		if left.Ticker != right.Ticker {
			return left.Ticker < right.Ticker
		}
		return left.InstrumentID < right.InstrumentID
	})

	for i := range result {
		result[i].Sequence = i + 1
	}
	return result
}

func transactionSideWeight(side string) int {
	switch strings.ToLower(strings.TrimSpace(side)) {
	case planner.ItemSideSell:
		return 0
	case planner.ItemSideBuy:
		return 1
	default:
		return 2
	}
}

func transactionInstrumentKey(ticker string, instrumentID string) string {
	normalizedTicker := strings.ToUpper(strings.TrimSpace(ticker))
	normalizedInstrumentID := strings.ToUpper(strings.TrimSpace(instrumentID))
	if normalizedInstrumentID == "" {
		normalizedInstrumentID = normalizedTicker
	}
	if normalizedTicker == "" {
		normalizedTicker = normalizedInstrumentID
	}
	if normalizedInstrumentID == "" {
		return ""
	}
	return normalizedTicker + "::" + normalizedInstrumentID
}

func toJSONMap(value interface{}) (datatypes.JSONMap, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	result := datatypes.JSONMap{}
	if err := json.Unmarshal(encoded, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func decodeJSONPayloadMap(source datatypes.JSONMap, target interface{}) error {
	encoded, err := json.Marshal(source)
	if err != nil {
		return err
	}
	return json.Unmarshal(encoded, target)
}

func decodeRebalanceSummary(source datatypes.JSONMap, target *dto.PortfolioRebalanceSummary) error {
	if target == nil {
		return fmt.Errorf("target is nil")
	}
	if err := decodeJSONPayloadMap(source, target); err == nil {
		if target.InvestableCapital == 0 {
			if value, ok := readNumber(source, "total_portfolio_value"); ok {
				target.InvestableCapital = value
			}
		}
		return nil
	}

	target.ItemsTotal = int(readNumberDefault(source, "items_total", 0))
	target.ActionableItems = int(readNumberDefault(source, "actionable_items", 0))
	target.UnresolvedItems = int(readNumberDefault(source, "unresolved_items", 0))
	target.FilteredZeroDelta = int(readNumberDefault(source, "filtered_zero_delta", 0))
	target.EstimatedTurnoverAbs = readNumberDefault(source, "estimated_turnover_abs", 0)
	target.InvestableCapital = readNumberDefault(source, "investable_capital", readNumberDefault(source, "total_portfolio_value", 0))
	return nil
}

func readNumber(source map[string]interface{}, key string) (float64, bool) {
	raw, ok := source[key]
	if !ok {
		return 0, false
	}
	switch typed := raw.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case uint:
		return float64(typed), true
	case uint64:
		return float64(typed), true
	case uint32:
		return float64(typed), true
	case json.Number:
		parsed, err := typed.Float64()
		if err == nil {
			return parsed, true
		}
	case string:
		var parsed float64
		if _, err := fmt.Sscan(typed, &parsed); err == nil {
			return parsed, true
		}
	}
	return 0, false
}

func readNumberDefault(source map[string]interface{}, key string, fallback float64) float64 {
	if value, ok := readNumber(source, key); ok {
		return value
	}
	return fallback
}

func cloneFloatPtr(value *float64) *float64 {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
