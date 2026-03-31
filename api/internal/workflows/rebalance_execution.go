package workflows

import (
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

const (
	RebalanceExecutionWorkflowName  = "rebalance.execute"
	RebalanceExecuteRunActivityName = "rebalance.execute_run_activity"
)

type RebalanceExecutionParams struct {
	UserID      int `json:"userId"`
	PortfolioID int `json:"portfolioId"`
	RunID       int `json:"runId"`
}

type RebalanceExecutionResult struct {
	Total     int `json:"total"`
	Completed int `json:"completed"`
	Failed    int `json:"failed"`
}

func RebalanceExecutionWorkflow(ctx workflow.Context, params RebalanceExecutionParams) error {
	ctx = workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    2 * time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    30 * time.Second,
			MaximumAttempts:    3,
		},
	})

	var result RebalanceExecutionResult
	return workflow.ExecuteActivity(ctx, RebalanceExecuteRunActivityName, params).Get(ctx, &result)
}
