package rebalance

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"server/internal/workflows"

	"go.temporal.io/api/serviceerror"
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

func (s *TemporalExecutionStarter) StartRebalanceExecution(ctx context.Context, userID int, portfolioID int, runID int) error {
	if s == nil || s.address == "" || s.namespace == "" || s.taskQueue == "" {
		return ErrExecutionUnavailable
	}

	temporalClient, err := client.Dial(client.Options{
		HostPort:  s.address,
		Namespace: s.namespace,
	})
	if err != nil {
		return fmt.Errorf("temporal client connection failed: %w", err)
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
		return err
	}
	return nil
}
