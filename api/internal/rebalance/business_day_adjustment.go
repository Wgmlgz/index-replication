package rebalance

import (
	"fmt"
	"strings"
)

type businessDayAdjustmentPolicy string

const (
	businessDayAdjustmentStrict            businessDayAdjustmentPolicy = "strict"
	businessDayAdjustmentFollowing         businessDayAdjustmentPolicy = "following"
	businessDayAdjustmentPreceding         businessDayAdjustmentPolicy = "preceding"
	businessDayAdjustmentModifiedFollowing businessDayAdjustmentPolicy = "modified_following"
	businessDayAdjustmentModifiedPreceding businessDayAdjustmentPolicy = "modified_preceding"
	defaultBusinessDayAdjustmentPolicy     businessDayAdjustmentPolicy = businessDayAdjustmentStrict
)

func parseBusinessDayAdjustmentPolicy(raw string) (businessDayAdjustmentPolicy, error) {
	value := strings.TrimSpace(strings.ToLower(raw))
	if value == "" {
		return defaultBusinessDayAdjustmentPolicy, nil
	}

	policy := businessDayAdjustmentPolicy(value)
	switch policy {
	case businessDayAdjustmentStrict,
		businessDayAdjustmentFollowing,
		businessDayAdjustmentPreceding,
		businessDayAdjustmentModifiedFollowing,
		businessDayAdjustmentModifiedPreceding:
		return policy, nil
	default:
		return "", fmt.Errorf(
			"%w: business_day_adjustment must be one of strict|following|preceding|modified_following|modified_preceding",
			ErrInvalidRequest,
		)
	}
}
