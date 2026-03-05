package temporalsetup

import (
	"context"
	"errors"
	"fmt"

	"server/internal/workflows"

	"go.temporal.io/api/serviceerror"
	"go.temporal.io/sdk/client"
)

type ScheduleOptions struct {
	TaskQueue               string
	TimeZone                string
	EnableSearchAttributes  bool
	EnableMonthlyDeepResync bool
}

func ApplySchedules(ctx context.Context, temporalClient client.Client, options ScheduleOptions) error {
	scheduleClient := temporalClient.ScheduleClient()

	if err := upsertMetaRefreshSchedule(ctx, scheduleClient, options.TaskQueue, options.TimeZone, options.EnableSearchAttributes); err != nil {
		return fmt.Errorf("failed to upsert meta refresh schedule: %w", err)
	}
	if err := upsertDailySyncSchedule(ctx, scheduleClient, options.TaskQueue, options.TimeZone, options.EnableSearchAttributes); err != nil {
		return fmt.Errorf("failed to upsert daily sync schedule: %w", err)
	}
	if options.EnableMonthlyDeepResync {
		if err := upsertMonthlyDeepResyncSchedule(ctx, scheduleClient, options.TaskQueue, options.TimeZone, options.EnableSearchAttributes); err != nil {
			return fmt.Errorf("failed to upsert monthly deep resync schedule: %w", err)
		}
	}

	return nil
}

func upsertMetaRefreshSchedule(ctx context.Context, sc client.ScheduleClient, taskQueue, timezone string, enableSearchAttrs bool) error {
	const scheduleID = "moex-meta-refresh-6h"
	_, err := upsertSchedule(ctx, sc, scheduleID, client.ScheduleOptions{
		ID: scheduleID,
		Spec: client.ScheduleSpec{
			CronExpressions: []string{"0 */6 * * *"},
			TimeZoneName:    timezone,
		},
		Action: &client.ScheduleWorkflowAction{
			ID:        "moex-meta-refresh-workflow",
			TaskQueue: taskQueue,
			Workflow:  workflows.MetaRefreshWorkflow,
			Args: []interface{}{
				workflows.MetaRefreshParams{Mode: "regular", EnableSearchAttributes: enableSearchAttrs},
			},
		},
	})
	return err
}

func upsertDailySyncSchedule(ctx context.Context, sc client.ScheduleClient, taskQueue, timezone string, enableSearchAttrs bool) error {
	const scheduleID = "moex-daily-sync"
	_, err := upsertSchedule(ctx, sc, scheduleID, client.ScheduleOptions{
		ID: scheduleID,
		Spec: client.ScheduleSpec{
			CronExpressions: []string{"15 20 * * 1-5"},
			TimeZoneName:    timezone,
		},
		Action: &client.ScheduleWorkflowAction{
			ID:        "moex-daily-sync-workflow",
			TaskQueue: taskQueue,
			Workflow:  workflows.DailySyncWorkflow,
			Args: []interface{}{
				workflows.DailySyncParams{Mode: "regular", EnableSearchAttributes: enableSearchAttrs},
			},
		},
	})
	return err
}

func upsertMonthlyDeepResyncSchedule(ctx context.Context, sc client.ScheduleClient, taskQueue, timezone string, enableSearchAttrs bool) error {
	const scheduleID = "moex-monthly-deep-resync"
	_, err := upsertSchedule(ctx, sc, scheduleID, client.ScheduleOptions{
		ID: scheduleID,
		Spec: client.ScheduleSpec{
			CronExpressions: []string{"30 21 1 * *"},
			TimeZoneName:    timezone,
		},
		Action: &client.ScheduleWorkflowAction{
			ID:        "moex-monthly-deep-resync-workflow",
			TaskQueue: taskQueue,
			Workflow:  workflows.DailySyncWorkflow,
			Args: []interface{}{
				workflows.DailySyncParams{Mode: "full", EnableSearchAttributes: enableSearchAttrs},
			},
		},
	})
	return err
}

func upsertSchedule(ctx context.Context, sc client.ScheduleClient, scheduleID string, options client.ScheduleOptions) (client.ScheduleHandle, error) {
	handle := sc.GetHandle(ctx, scheduleID)
	_, err := handle.Describe(ctx)
	if err == nil {
		if err := handle.Delete(ctx); err != nil {
			return nil, err
		}
		return sc.Create(ctx, options)
	}

	var notFoundErr *serviceerror.NotFound
	if errors.As(err, &notFoundErr) {
		return sc.Create(ctx, options)
	}

	return nil, err
}
