package main

import (
	"context"
	"errors"
	"fmt"

	"go.temporal.io/api/serviceerror"
	"go.temporal.io/sdk/client"
)

type scheduleOptions struct {
	taskQueue               string
	timeZone                string
	enableSearchAttributes  bool
	enableMonthlyDeepResync bool
}

func applySchedules(ctx context.Context, temporalClient client.Client, options scheduleOptions) error {
	scheduleClient := temporalClient.ScheduleClient()

	if err := upsertMetaRefreshSchedule(ctx, scheduleClient, options.taskQueue, options.timeZone, options.enableSearchAttributes); err != nil {
		return fmt.Errorf("failed to upsert meta refresh schedule: %w", err)
	}
	if err := upsertDailySyncSchedule(ctx, scheduleClient, options.taskQueue, options.timeZone, options.enableSearchAttributes); err != nil {
		return fmt.Errorf("failed to upsert daily sync schedule: %w", err)
	}
	if err := upsertRebalanceDispatchSchedule(ctx, scheduleClient, options.taskQueue, options.timeZone); err != nil {
		return fmt.Errorf("failed to upsert rebalance dispatch schedule: %w", err)
	}
	if options.enableMonthlyDeepResync {
		if err := upsertMonthlyDeepResyncSchedule(ctx, scheduleClient, options.taskQueue, options.timeZone, options.enableSearchAttributes); err != nil {
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
			Workflow:  metaRefreshWorkflowName,
			Args: []any{
				metaRefreshParams{Mode: "regular", EnableSearchAttributes: enableSearchAttrs},
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
			Workflow:  dailySyncWorkflowName,
			Args: []any{
				dailySyncParams{Mode: "regular", EnableSearchAttributes: enableSearchAttrs},
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
			Workflow:  dailySyncWorkflowName,
			Args: []any{
				dailySyncParams{Mode: "full", EnableSearchAttributes: enableSearchAttrs},
			},
		},
	})
	return err
}

func upsertRebalanceDispatchSchedule(ctx context.Context, sc client.ScheduleClient, taskQueue, timezone string) error {
	const scheduleID = "rebalance-dispatch-1m"
	_, err := upsertSchedule(ctx, sc, scheduleID, client.ScheduleOptions{
		ID: scheduleID,
		Spec: client.ScheduleSpec{
			CronExpressions: []string{"* * * * *"},
			TimeZoneName:    timezone,
		},
		Action: &client.ScheduleWorkflowAction{
			ID:        "rebalance-schedule-dispatch-workflow",
			TaskQueue: taskQueue,
			Workflow:  rebalanceScheduleDispatchWorkflowName,
			Args: []any{
				rebalanceScheduleDispatchParams{},
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
