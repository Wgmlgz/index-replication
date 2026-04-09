package workflows

import (
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

const (
	RebalancePlanningWorkflowName = "rebalance.plan"
	RebalancePlanRunActivityName  = "rebalance.plan_run_activity"
)

type RebalancePlanningParams struct {
	UserID      int `json:"userId"`
	PortfolioID int `json:"portfolioId"`
	RunID       int `json:"runId"`
}

type RebalancePlanningResult struct {
	RunID     int        `json:"runId"`
	RunStatus string     `json:"runStatus"`
	StartedAt *time.Time `json:"startedAt"`
	EndedAt   *time.Time `json:"endedAt"`
}

func RebalancePlanningWorkflow(ctx workflow.Context, params RebalancePlanningParams) (RebalancePlanningResult, error) {
	ctx = workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			MaximumAttempts: 1,
		},
	})

	var result RebalancePlanningResult
	if err := workflow.ExecuteActivity(ctx, RebalancePlanRunActivityName, params).Get(ctx, &result); err != nil {
		return RebalancePlanningResult{}, err
	}
	return result, nil
}
