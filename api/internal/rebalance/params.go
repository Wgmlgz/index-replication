package rebalance

import (
	"fmt"
	"math"
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
		return models.PortfolioRebalanceExecutionModeAutomatic, nil
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
	}

	if len(raw) == 0 {
		return params, map[string]interface{}{
			"quantity_precision": float64(params.QuantityPrecision),
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
	snapshot := map[string]interface{}{
		"quantity_precision": float64(params.QuantityPrecision),
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
