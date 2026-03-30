package rebalance

import (
	"fmt"
	"math"
	"strconv"
	"strings"

	"server/internal/models"
	"server/internal/rebalance/planner"
)

type normalizedCreateRequest struct {
	ExecutionMode          string
	ConfirmationRequired   bool
	AsOfDate               string
	PlanningParams         planner.PlanningParams
	PlanningParamsSnapshot map[string]interface{}
}

func normalizeExecutionMode(raw string) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(raw))
	if mode == "" {
		return models.PortfolioRebalanceExecutionModeManual, nil
	}
	switch mode {
	case models.PortfolioRebalanceExecutionModeManual, models.PortfolioRebalanceExecutionModeAutomatic:
		return mode, nil
	default:
		return "", ErrInvalidExecutionMode
	}
}

func normalizePlanningParams(raw map[string]interface{}) (planner.PlanningParams, map[string]interface{}) {
	params := planner.PlanningParams{
		QuantityPrecision: 6,
		MinDeltaQuantity:  1e-6,
	}

	if len(raw) == 0 {
		return params, map[string]interface{}{
			"quantity_precision": float64(params.QuantityPrecision),
			"min_delta_quantity": params.MinDeltaQuantity,
		}
	}

	if value, ok := raw["quantity_precision"]; ok {
		precision, ok := asInt(value)
		if ok {
			if precision < 0 {
				precision = 0
			}
			if precision > 8 {
				precision = 8
			}
			params.QuantityPrecision = precision
		}
	}
	if value, ok := raw["min_delta_quantity"]; ok {
		minDelta, ok := asFloat(value)
		if ok && minDelta > 0 {
			params.MinDeltaQuantity = minDelta
		}
	}

	snapshot := map[string]interface{}{
		"quantity_precision": float64(params.QuantityPrecision),
		"min_delta_quantity": params.MinDeltaQuantity,
	}
	return params, snapshot
}

func asInt(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case int32:
		return int(typed), true
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) {
			return 0, false
		}
		return int(math.Round(typed)), true
	case float32:
		floatValue := float64(typed)
		if math.IsNaN(floatValue) || math.IsInf(floatValue, 0) {
			return 0, false
		}
		return int(math.Round(floatValue)), true
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return 0, false
		}
		var parsed int
		_, err := fmt.Sscanf(trimmed, "%d", &parsed)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func asFloat(value interface{}) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		if math.IsNaN(typed) || math.IsInf(typed, 0) {
			return 0, false
		}
		return typed, true
	case float32:
		parsed := float64(typed)
		if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
			return 0, false
		}
		return parsed, true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return 0, false
		}
		parsed, err := strconv.ParseFloat(trimmed, 64)
		if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}
