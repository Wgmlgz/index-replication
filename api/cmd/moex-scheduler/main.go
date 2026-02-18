package main

import (
	"context"
	"errors"
	"log"
	"server/internal/config"
	"server/internal/workflows"

	"go.temporal.io/api/serviceerror"
	"go.temporal.io/sdk/client"
)

func main() {
	cfg := config.LoadConfig()
	ctx := context.Background()

	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalAddr,
		Namespace: cfg.TemporalNS,
	})
	if err != nil {
		log.Fatalf("Temporal client connection failed: %v", err)
	}
	defer temporalClient.Close()

	scheduleClient := temporalClient.ScheduleClient()

	if err := upsertMetaRefreshSchedule(ctx, scheduleClient, cfg.TemporalQueue, cfg.MoexScheduleTimezone, cfg.TemporalEnableSearchAttrs); err != nil {
		log.Fatalf("failed to upsert meta refresh schedule: %v", err)
	}
	if err := upsertDailySyncSchedule(ctx, scheduleClient, cfg.TemporalQueue, cfg.MoexScheduleTimezone, cfg.TemporalEnableSearchAttrs); err != nil {
		log.Fatalf("failed to upsert daily sync schedule: %v", err)
	}
	if cfg.MoexEnableMonthlyDeepResync {
		if err := upsertMonthlyDeepResyncSchedule(ctx, scheduleClient, cfg.TemporalQueue, cfg.MoexScheduleTimezone, cfg.TemporalEnableSearchAttrs); err != nil {
			log.Fatalf("failed to upsert monthly deep resync schedule: %v", err)
		}
	}

	log.Printf("Temporal schedules applied namespace=%s taskQueue=%s", cfg.TemporalNS, cfg.TemporalQueue)
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
