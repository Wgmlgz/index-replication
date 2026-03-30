package planner

import "math"

func BuildSummary(items []Item, investableCapital float64) Summary {
	summary := Summary{
		ItemsTotal:        len(items),
		InvestableCapital: round(investableCapital, 4),
	}
	for _, item := range items {
		switch item.Status {
		case ItemStatusUnresolved:
			summary.UnresolvedItems++
		default:
			summary.ActionableItems++
		}
		if item.PlannedAmount != nil {
			summary.EstimatedTurnoverAbs = round(summary.EstimatedTurnoverAbs+math.Abs(*item.PlannedAmount), 2)
		}
	}
	return summary
}
