package main

import (
	"log"
	"server/internal/activities"
	"server/internal/config"
	"server/internal/marketprice"
	"server/internal/moex"
	"server/internal/portfolio"
	"server/internal/rebalance"
	rebalanceplanner "server/internal/rebalance/planner"
	"server/internal/repository"
	"server/internal/services"
	"server/internal/tbank"
	"server/internal/workflows"

	"go.temporal.io/sdk/activity"
	"go.temporal.io/sdk/client"
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"
)

func main() {
	cfg := config.LoadConfig()
	db := config.InitDB(cfg)
	repos := repository.NewRepositoryRegistry(db)
	auditService := services.NewAuditService(db)

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
	moexLiveService := moex.NewMoexService(cfg.MoexBaseURL)
	moexReadService := moex.NewMoexReadService(repos.MoexDataRepo, moexLiveService, cfg.MoexLiveCurrentDayEnabled)
	marketPriceService := marketprice.NewService(
		repos.MarketPriceRepo,
		repos.MoexDataRepo,
		repos.MoexSyncRepo,
		moexLiveService,
	)
	tbankService := tbank.NewService(
		tbank.Config{
			TBankInvestGrpcEndpoint:        cfg.TBankInvestGrpcEndpoint,
			TBankInvestSandboxGrpcEndpoint: cfg.TBankInvestSandboxGrpcEndpoint,
			TBankCACertFile:                cfg.TBankCACertFile,
		},
		repos.UserSettingsRepo,
		auditService,
		marketPriceService,
	)
	tbankProvider := portfolio.NewTBankProvider(tbankService)
	mockProvider := portfolio.NewMockProvider()
	virtualProvider := portfolio.NewVirtualProvider(repos.VirtualPortfolioTransactionsRepo, marketPriceService)
	portfolioService := portfolio.NewService(
		repos.PortfolioProfilesRepo,
		repos.PortfolioReplicationConfigsRepo,
		auditService,
		tbankProvider,
		mockProvider,
		virtualProvider,
	)
	rebalancePlanner := rebalanceplanner.NewService(
		rebalanceplanner.NewRegistry(
			rebalanceplanner.NewFullAlgorithm(),
		),
	)
	rebalanceSnapshotLoader := rebalance.NewSnapshotLoader(
		repos.PortfolioProfilesRepo,
		repos.PortfolioReplicationConfigsRepo,
		moexReadService,
		marketPriceService,
		tbankProvider,
		mockProvider,
		virtualProvider,
	)
	rebalanceService := rebalance.NewService(
		repos.PortfolioProfilesRepo,
		repos.PortfolioRebalancesRepo,
		rebalanceSnapshotLoader,
		rebalancePlanner,
		auditService,
		nil,
	)
	rebalancePlanningActs := activities.NewRebalancePlanningActivities(rebalanceService)
	rebalanceActs := activities.NewRebalanceExecutionActivities(
		repos.PortfolioRebalancesRepo,
		portfolioService,
	)

	w.RegisterWorkflowWithOptions(workflows.MetaRefreshWorkflow, workflow.RegisterOptions{Name: workflows.MetaRefreshWorkflowName})
	w.RegisterWorkflowWithOptions(workflows.DailySyncWorkflow, workflow.RegisterOptions{Name: workflows.DailySyncWorkflowName})
	w.RegisterWorkflowWithOptions(workflows.DailySyncWorkflow, workflow.RegisterOptions{Name: "DailySyncWorkflow"})
	w.RegisterWorkflowWithOptions(workflows.RebalancePlanningWorkflow, workflow.RegisterOptions{Name: workflows.RebalancePlanningWorkflowName})
	w.RegisterWorkflowWithOptions(workflows.RebalanceExecutionWorkflow, workflow.RegisterOptions{Name: workflows.RebalanceExecutionWorkflowName})

	w.RegisterActivityWithOptions(acts.MetaRefresh, activity.RegisterOptions{Name: workflows.MetaRefreshActivityName})
	w.RegisterActivityWithOptions(acts.DailySync, activity.RegisterOptions{Name: workflows.DailySyncActivityName})
	w.RegisterActivityWithOptions(acts.ListIndexSecids, activity.RegisterOptions{Name: workflows.ListIndexSecidsActivityName})
	w.RegisterActivityWithOptions(acts.SyncIndex, activity.RegisterOptions{Name: workflows.SyncIndexActivityName})
	w.RegisterActivityWithOptions(acts.DailySync, activity.RegisterOptions{Name: "moex.daily_sync_legacy_activity"})
	w.RegisterActivityWithOptions(rebalancePlanningActs.PlanRun, activity.RegisterOptions{Name: workflows.RebalancePlanRunActivityName})
	w.RegisterActivityWithOptions(rebalanceActs.ExecuteRun, activity.RegisterOptions{Name: workflows.RebalanceExecuteRunActivityName})

	log.Printf("Temporal worker started address=%s namespace=%s taskQueue=%s", cfg.TemporalAddr, cfg.TemporalNS, cfg.TemporalQueue)
	if err := w.Run(worker.InterruptCh()); err != nil {
		log.Fatalf("Temporal worker exited with error: %v", err)
	}
}
