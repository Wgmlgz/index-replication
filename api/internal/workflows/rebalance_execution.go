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

type RebalanceExecutionProgress struct {
	TotalItems        int        `json:"totalItems"`
	ActionableItems   int        `json:"actionableItems"`
	UnresolvedItems   int        `json:"unresolvedItems"`
	PendingItems      int        `json:"pendingItems"`
	ExecutingItems    int        `json:"executingItems"`
	CompletedItems    int        `json:"completedItems"`
	FailedItems       int        `json:"failedItems"`
	CompletionPercent float64    `json:"completionPercent"`
	IsTerminal        bool       `json:"isTerminal"`
	LastEventAt       *time.Time `json:"lastEventAt"`
}

type RebalanceExecutionItem struct {
	ID                  int        `json:"id"`
	Ticker              string     `json:"ticker"`
	InstrumentID        string     `json:"instrumentId"`
	Side                string     `json:"side"`
	CurrentQuantity     float64    `json:"currentQuantity"`
	TargetQuantity      float64    `json:"targetQuantity"`
	DeltaQuantity       float64    `json:"deltaQuantity"`
	ReferencePrice      *float64   `json:"referencePrice"`
	PlannedAmount       *float64   `json:"plannedAmount"`
	Status              string     `json:"status"`
	LastError           *string    `json:"lastError"`
	LastActionID        *string    `json:"lastActionID"`
	ProviderOperationID *string    `json:"providerOperationID"`
	LastEventAt         *time.Time `json:"lastEventAt"`
}

type RebalanceExecutionLink struct {
	ID                      int                    `json:"id"`
	RebalanceItemID         *int                   `json:"rebalanceItemId"`
	Status                  string                 `json:"status"`
	ProviderOperationID     *string                `json:"providerOperationID"`
	ProviderOperationCursor *string                `json:"providerOperationCursor"`
	Metadata                map[string]interface{} `json:"metadata"`
	CreatedAt               time.Time              `json:"createdAt"`
	UpdatedAt               time.Time              `json:"updatedAt"`
}

type RebalanceExecutionResult struct {
	RunID     int                        `json:"runId"`
	RunStatus string                     `json:"runStatus"`
	StartedAt *time.Time                 `json:"startedAt"`
	EndedAt   *time.Time                 `json:"endedAt"`
	Progress  RebalanceExecutionProgress `json:"progress"`
	Items     []RebalanceExecutionItem   `json:"items"`
	Links     []RebalanceExecutionLink   `json:"links"`
}

func RebalanceExecutionWorkflow(ctx workflow.Context, params RebalanceExecutionParams) (RebalanceExecutionResult, error) {
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
	if err := workflow.ExecuteActivity(ctx, RebalanceExecuteRunActivityName, params).Get(ctx, &result); err != nil {
		return RebalanceExecutionResult{}, err
	}
	return result, nil
}
