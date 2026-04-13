package workflows

import (
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

const (
	RebalanceScheduleDispatchWorkflowName          = "rebalance.schedule.dispatch"
	RebalanceScheduleDispatchSelectDueActivityName = "rebalance.schedule.dispatch.select_due_activity"
	defaultRebalanceDispatchWindowSeconds          = 24 * 60 * 60
)

type RebalanceScheduleDispatchParams struct {
	WindowSeconds int `json:"windowSeconds,omitempty"`
}

type RebalanceScheduleDispatchActivityParams struct {
	WindowStart time.Time `json:"windowStart"`
	WindowEnd   time.Time `json:"windowEnd"`
}

type RebalanceScheduleDispatchCandidate struct {
	PortfolioProfileID int       `json:"portfolioProfileId"`
	ScheduleID         int       `json:"scheduleId"`
	DueAt              time.Time `json:"dueAt"`
}

type RebalanceScheduleDispatchCreatedRun struct {
	PortfolioProfileID int       `json:"portfolioProfileId"`
	ScheduleID         int       `json:"scheduleId"`
	DueAt              time.Time `json:"dueAt"`
	RunID              int       `json:"runId"`
}

type RebalanceScheduleDispatchResult struct {
	Enabled            bool                                  `json:"enabled"`
	WindowStart        time.Time                             `json:"windowStart"`
	WindowEnd          time.Time                             `json:"windowEnd"`
	EvaluatedSchedules int                                   `json:"evaluatedSchedules"`
	InvalidSchedules   int                                   `json:"invalidSchedules"`
	DueCandidates      []RebalanceScheduleDispatchCandidate  `json:"dueCandidates"`
	OverdueCandidates  []RebalanceScheduleDispatchCandidate  `json:"overdueCandidates"`
	ClaimedSchedules   int                                   `json:"claimedSchedules"`
	SkippedSchedules   int                                   `json:"skippedSchedules"`
	CreatedRuns        int                                   `json:"createdRuns"`
	FailedRuns         int                                   `json:"failedRuns"`
	Created            []RebalanceScheduleDispatchCreatedRun `json:"created"`
}

func RebalanceScheduleDispatchWorkflow(
	ctx workflow.Context,
	params RebalanceScheduleDispatchParams,
) (RebalanceScheduleDispatchResult, error) {
	windowSeconds := params.WindowSeconds
	if windowSeconds <= 0 {
		windowSeconds = defaultRebalanceDispatchWindowSeconds
	}
	windowEnd := workflow.Now(ctx).UTC()
	windowStart := windowEnd.Add(-time.Duration(windowSeconds) * time.Second)

	ctx = workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
		StartToCloseTimeout: 5 * time.Minute,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    2 * time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    30 * time.Second,
			MaximumAttempts:    3,
		},
	})

	var result RebalanceScheduleDispatchResult
	if err := workflow.ExecuteActivity(ctx, RebalanceScheduleDispatchSelectDueActivityName, RebalanceScheduleDispatchActivityParams{
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
	}).Get(ctx, &result); err != nil {
		return RebalanceScheduleDispatchResult{}, err
	}
	return result, nil
}
