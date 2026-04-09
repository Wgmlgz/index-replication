package activities

import (
	"context"
	"fmt"
	"time"

	"server/internal/models"
	"server/internal/workflows"

	"go.temporal.io/sdk/activity"
)

type rebalancePlanningService interface {
	ProcessDraftPlanningRun(
		ctx context.Context,
		userID int,
		portfolioID int,
		runID int,
		reportProgress func(workflows.RebalancePlanningStatus),
	) (*models.PortfolioRebalanceRun, error)
}

type RebalancePlanningActivities struct {
	service rebalancePlanningService
}

func NewRebalancePlanningActivities(service rebalancePlanningService) *RebalancePlanningActivities {
	return &RebalancePlanningActivities{
		service: service,
	}
}

func (a *RebalancePlanningActivities) PlanRun(
	ctx context.Context,
	params workflows.RebalancePlanningParams,
) (workflows.RebalancePlanningResult, error) {
	result := workflows.RebalancePlanningResult{
		RunID:     params.RunID,
		RunStatus: models.PortfolioRebalanceRunStatusPlanningFailed,
	}
	if a == nil || a.service == nil {
		return result, fmt.Errorf("rebalance planning activity is not initialized")
	}
	if params.UserID <= 0 || params.PortfolioID <= 0 || params.RunID <= 0 {
		return result, fmt.Errorf("invalid rebalance planning params")
	}

	runModel, err := a.service.ProcessDraftPlanningRun(
		ctx,
		params.UserID,
		params.PortfolioID,
		params.RunID,
		func(status workflows.RebalancePlanningStatus) {
			recordPlanningHeartbeat(ctx, status)
		},
	)
	if err != nil {
		return result, err
	}
	if runModel == nil {
		return result, nil
	}

	result.RunID = runModel.ID
	result.RunStatus = runModel.Status
	result.StartedAt = runModel.StartedAt
	result.EndedAt = runModel.EndedAt
	return result, nil
}

func recordPlanningHeartbeat(ctx context.Context, status workflows.RebalancePlanningStatus) {
	copy := status
	if copy.RunID <= 0 {
		return
	}
	if copy.Progress.LastEventAt == nil {
		now := time.Now().UTC()
		copy.Progress.LastEventAt = &now
	}
	activity.RecordHeartbeat(ctx, copy)
}
