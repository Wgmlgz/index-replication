package rebalance

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"server/internal/models"
	"server/internal/workflows"

	enumspb "go.temporal.io/api/enums/v1"
	"go.temporal.io/api/serviceerror"
	workflowservice "go.temporal.io/api/workflowservice/v1"
	"go.temporal.io/sdk/client"
)

type TemporalExecutionStarter struct {
	address   string
	namespace string
	taskQueue string
}

func NewTemporalExecutionStarter(address string, namespace string, taskQueue string) *TemporalExecutionStarter {
	return &TemporalExecutionStarter{
		address:   strings.TrimSpace(address),
		namespace: strings.TrimSpace(namespace),
		taskQueue: strings.TrimSpace(taskQueue),
	}
}

func (s *TemporalExecutionStarter) StartRebalancePlanning(ctx context.Context, userID int, portfolioID int, runID int) error {
	if s == nil || s.address == "" || s.namespace == "" || s.taskQueue == "" {
		return ErrPlanningUnavailable
	}

	temporalClient, err := client.Dial(client.Options{
		HostPort:  s.address,
		Namespace: s.namespace,
	})
	if err != nil {
		return normalizeTemporalPlanningError(fmt.Errorf("temporal client connection failed: %w", err))
	}
	defer temporalClient.Close()

	_, err = temporalClient.ExecuteWorkflow(
		ctx,
		client.StartWorkflowOptions{
			ID:        rebalancePlanningWorkflowID(runID),
			TaskQueue: s.taskQueue,
		},
		workflows.RebalancePlanningWorkflow,
		workflows.RebalancePlanningParams{
			UserID:      userID,
			PortfolioID: portfolioID,
			RunID:       runID,
		},
	)
	if err != nil {
		var alreadyStarted *serviceerror.WorkflowExecutionAlreadyStarted
		if errors.As(err, &alreadyStarted) {
			return nil
		}
		return normalizeTemporalPlanningError(err)
	}
	return nil
}

func (s *TemporalExecutionStarter) StartRebalanceExecution(ctx context.Context, userID int, portfolioID int, runID int) error {
	if s == nil || s.address == "" || s.namespace == "" || s.taskQueue == "" {
		return ErrExecutionUnavailable
	}

	temporalClient, err := client.Dial(client.Options{
		HostPort:  s.address,
		Namespace: s.namespace,
	})
	if err != nil {
		return normalizeTemporalError(fmt.Errorf("temporal client connection failed: %w", err))
	}
	defer temporalClient.Close()

	_, err = temporalClient.ExecuteWorkflow(
		ctx,
		client.StartWorkflowOptions{
			ID:        fmt.Sprintf("rebalance-run-%d", runID),
			TaskQueue: s.taskQueue,
		},
		workflows.RebalanceExecutionWorkflow,
		workflows.RebalanceExecutionParams{
			UserID:      userID,
			PortfolioID: portfolioID,
			RunID:       runID,
		},
	)
	if err != nil {
		var alreadyStarted *serviceerror.WorkflowExecutionAlreadyStarted
		if errors.As(err, &alreadyStarted) {
			return nil
		}
		return normalizeTemporalError(err)
	}
	return nil
}

func (s *TemporalExecutionStarter) GetRebalancePlanningStatus(
	ctx context.Context,
	runID int,
) (*workflows.RebalancePlanningStatus, error) {
	if s == nil || s.address == "" || s.namespace == "" || s.taskQueue == "" {
		return nil, ErrPlanningUnavailable
	}
	if runID <= 0 {
		return nil, ErrInvalidRebalanceID
	}

	temporalClient, err := client.Dial(client.Options{
		HostPort:  s.address,
		Namespace: s.namespace,
	})
	if err != nil {
		return nil, normalizeTemporalPlanningError(fmt.Errorf("temporal client connection failed: %w", err))
	}
	defer temporalClient.Close()

	workflowID := rebalancePlanningWorkflowID(runID)
	describe, err := temporalClient.DescribeWorkflowExecution(ctx, workflowID, "")
	if err != nil {
		var notFound *serviceerror.NotFound
		if errors.As(err, &notFound) {
			return nil, ErrExecutionNotFound
		}
		return nil, normalizeTemporalPlanningError(err)
	}

	if describe.GetWorkflowExecutionInfo().GetStatus() == enumspb.WORKFLOW_EXECUTION_STATUS_RUNNING {
		if heartbeat := decodePlanningHeartbeat(describe); heartbeat != nil {
			return heartbeat, nil
		}
		now := time.Now().UTC()
		return &workflows.RebalancePlanningStatus{
			RunID:     runID,
			RunStatus: models.PortfolioRebalanceRunStatusPlanning,
			Progress:  planningProgressStarted(now),
		}, nil
	}

	workflowRunID := ""
	if info := describe.GetWorkflowExecutionInfo(); info != nil && info.GetExecution() != nil {
		workflowRunID = info.GetExecution().GetRunId()
	}
	workflowRun := temporalClient.GetWorkflow(ctx, workflowID, workflowRunID)
	var result workflows.RebalancePlanningResult
	if err := workflowRun.Get(ctx, &result); err != nil {
		return nil, normalizeTemporalPlanningError(err)
	}
	if result.RunID <= 0 {
		result.RunID = runID
	}

	status := result.RunStatus
	if status == "" {
		status = models.PortfolioRebalanceRunStatusPlanningFailed
	}
	finishedAt := time.Now().UTC()
	if result.EndedAt != nil {
		finishedAt = result.EndedAt.UTC()
	}
	progress := planningProgressFailed(planningStageCodeFailed, "Planning failed", finishedAt)
	if status == models.PortfolioRebalanceRunStatusDraft {
		progress = planningProgressCompleted(finishedAt)
	}
	return &workflows.RebalancePlanningStatus{
		RunID:     result.RunID,
		RunStatus: status,
		Progress:  progress,
	}, nil
}

func (s *TemporalExecutionStarter) GetRebalanceStatus(
	ctx context.Context,
	runID int,
) (*workflows.RebalanceExecutionResult, error) {
	if s == nil || s.address == "" || s.namespace == "" || s.taskQueue == "" {
		return nil, ErrExecutionUnavailable
	}
	if runID <= 0 {
		return nil, ErrInvalidRebalanceID
	}

	temporalClient, err := client.Dial(client.Options{
		HostPort:  s.address,
		Namespace: s.namespace,
	})
	if err != nil {
		return nil, normalizeTemporalError(fmt.Errorf("temporal client connection failed: %w", err))
	}
	defer temporalClient.Close()

	workflowID := rebalanceWorkflowID(runID)
	describe, err := temporalClient.DescribeWorkflowExecution(ctx, workflowID, "")
	if err != nil {
		var notFound *serviceerror.NotFound
		if errors.As(err, &notFound) {
			return nil, ErrExecutionNotFound
		}
		return nil, normalizeTemporalError(err)
	}

	if describe.GetWorkflowExecutionInfo().GetStatus() == enumspb.WORKFLOW_EXECUTION_STATUS_RUNNING {
		if heartbeat := decodeExecutionHeartbeat(describe); heartbeat != nil {
			return heartbeat, nil
		}
		return &workflows.RebalanceExecutionResult{
			RunID:     runID,
			RunStatus: "executing",
			Progress: workflows.RebalanceExecutionProgress{
				StageCode:    "execution_running",
				StageMessage: "Execution in progress",
				IsTerminal:   false,
			},
			Items: []workflows.RebalanceExecutionItem{},
			Links: []workflows.RebalanceExecutionLink{},
		}, nil
	}

	workflowRunID := ""
	if info := describe.GetWorkflowExecutionInfo(); info != nil && info.GetExecution() != nil {
		workflowRunID = info.GetExecution().GetRunId()
	}
	workflowRun := temporalClient.GetWorkflow(ctx, workflowID, workflowRunID)
	var result workflows.RebalanceExecutionResult
	if err := workflowRun.Get(ctx, &result); err != nil {
		return nil, normalizeTemporalError(err)
	}
	if result.RunStatus == "" {
		result.RunStatus = mapWorkflowStatus(describe.GetWorkflowExecutionInfo().GetStatus())
	}
	if result.RunID <= 0 {
		result.RunID = runID
	}
	return &result, nil
}

func decodeExecutionHeartbeat(
	describe *workflowservice.DescribeWorkflowExecutionResponse,
) *workflows.RebalanceExecutionResult {
	if describe == nil {
		return nil
	}
	for _, pending := range describe.GetPendingActivities() {
		if pending == nil {
			continue
		}
		if pending.GetActivityType().GetName() != workflows.RebalanceExecuteRunActivityName {
			continue
		}
		details := pending.GetHeartbeatDetails()
		if details == nil {
			continue
		}
		var result workflows.RebalanceExecutionResult
		if err := client.NewValues(details).Get(&result); err == nil {
			return &result
		}
	}
	return nil
}

func decodePlanningHeartbeat(
	describe *workflowservice.DescribeWorkflowExecutionResponse,
) *workflows.RebalancePlanningStatus {
	if describe == nil {
		return nil
	}
	for _, pending := range describe.GetPendingActivities() {
		if pending == nil {
			continue
		}
		if pending.GetActivityType().GetName() != workflows.RebalancePlanRunActivityName {
			continue
		}
		details := pending.GetHeartbeatDetails()
		if details == nil {
			continue
		}
		var status workflows.RebalancePlanningStatus
		if err := client.NewValues(details).Get(&status); err == nil {
			return &status
		}
	}
	return nil
}

func mapWorkflowStatus(status enumspb.WorkflowExecutionStatus) string {
	switch status {
	case enumspb.WORKFLOW_EXECUTION_STATUS_RUNNING:
		return "executing"
	case enumspb.WORKFLOW_EXECUTION_STATUS_COMPLETED:
		return "completed"
	case enumspb.WORKFLOW_EXECUTION_STATUS_FAILED,
		enumspb.WORKFLOW_EXECUTION_STATUS_CANCELED,
		enumspb.WORKFLOW_EXECUTION_STATUS_TERMINATED,
		enumspb.WORKFLOW_EXECUTION_STATUS_TIMED_OUT:
		return "failed"
	default:
		return "unknown"
	}
}

func rebalanceWorkflowID(runID int) string {
	return fmt.Sprintf("rebalance-run-%d", runID)
}

func rebalancePlanningWorkflowID(runID int) string {
	return fmt.Sprintf("rebalance-plan-%d", runID)
}

func normalizeTemporalError(err error) error {
	if err == nil {
		return nil
	}
	var unavailable *serviceerror.Unavailable
	var namespaceNotFound *serviceerror.NamespaceNotFound
	message := strings.ToLower(err.Error())
	if errors.As(err, &unavailable) || errors.As(err, &namespaceNotFound) ||
		errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) ||
		strings.Contains(message, "failed reaching server") ||
		strings.Contains(message, "connection refused") ||
		strings.Contains(message, "context deadline exceeded") {
		return fmt.Errorf("%w: %v", ErrExecutionUnavailable, err)
	}
	return err
}

func normalizeTemporalPlanningError(err error) error {
	if err == nil {
		return nil
	}
	var unavailable *serviceerror.Unavailable
	var namespaceNotFound *serviceerror.NamespaceNotFound
	message := strings.ToLower(err.Error())
	if errors.As(err, &unavailable) || errors.As(err, &namespaceNotFound) ||
		errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) ||
		strings.Contains(message, "failed reaching server") ||
		strings.Contains(message, "connection refused") ||
		strings.Contains(message, "context deadline exceeded") {
		return fmt.Errorf("%w: %v", ErrPlanningUnavailable, err)
	}
	return err
}
