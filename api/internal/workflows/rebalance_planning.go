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

type RebalancePlanningProgress struct {
	TotalItems        int        `json:"totalItems"`
	ActionableItems   int        `json:"actionableItems"`
	PendingItems      int        `json:"pendingItems"`
	ExecutingItems    int        `json:"executingItems"`
	CompletedItems    int        `json:"completedItems"`
	FailedItems       int        `json:"failedItems"`
	CompletionPercent float64    `json:"completionPercent"`
	StageCode         string     `json:"stageCode"`
	StageMessage      string     `json:"stageMessage"`
	StageIndex        int        `json:"stageIndex"`
	StageTotal        int        `json:"stageTotal"`
	IsTerminal        bool       `json:"isTerminal"`
	LastEventAt       *time.Time `json:"lastEventAt"`
}

type RebalancePlanningStatus struct {
	RunID     int                       `json:"runId"`
	RunStatus string                    `json:"runStatus"`
	Progress  RebalancePlanningProgress `json:"progress"`
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
