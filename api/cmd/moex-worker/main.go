package main

import (
	"log"
	"server/internal/activities"
	"server/internal/config"
	"server/internal/workflows"

	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"
)

func main() {
	cfg := config.LoadConfig()
	db := config.InitDB(cfg)

	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalAddr,
		Namespace: cfg.TemporalNS,
	})
	if err != nil {
		log.Fatalf("Temporal client connection failed: %v", err)
	}
	defer temporalClient.Close()

	w := worker.New(temporalClient, cfg.TemporalQueue, worker.Options{})
	acts := activities.NewMoexSyncActivities(db, cfg.MoexBaseURL, cfg.MoexMutableDays, cfg.MoexImmutableBeforeDate)

	w.RegisterWorkflowWithOptions(workflows.MetaRefreshWorkflow, workflow.RegisterOptions{Name: workflows.MetaRefreshWorkflowName})
	w.RegisterWorkflowWithOptions(workflows.DailySyncWorkflow, workflow.RegisterOptions{Name: workflows.DailySyncWorkflowName})
	w.RegisterWorkflowWithOptions(workflows.DailySyncWorkflow, workflow.RegisterOptions{Name: "DailySyncWorkflow"})

	w.RegisterActivityWithOptions(acts.MetaRefresh, activity.RegisterOptions{Name: workflows.MetaRefreshActivityName})
	w.RegisterActivityWithOptions(acts.DailySync, activity.RegisterOptions{Name: workflows.DailySyncActivityName})
	w.RegisterActivityWithOptions(acts.DailySync, activity.RegisterOptions{Name: "moex.daily_sync_legacy_activity"})

	log.Printf("Temporal worker started address=%s namespace=%s taskQueue=%s", cfg.TemporalAddr, cfg.TemporalNS, cfg.TemporalQueue)
	if err := w.Run(worker.InterruptCh()); err != nil {
		log.Fatalf("Temporal worker exited with error: %v", err)
	}
}
