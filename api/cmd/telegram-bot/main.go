package main

import (
	"context"
	"log"
	"os/signal"
	"server/internal/approvals"
	"server/internal/config"
	"server/internal/notifications"
	"server/internal/rebalance"
	"server/internal/repository"
	"server/internal/services"
	"server/internal/telegram"
	"syscall"
)

func main() {
	cfg := config.LoadConfig()
	db := config.InitDB(cfg)
	repoRegistry := repository.NewRepositoryRegistry(db)
	auditService := services.NewAuditService(db)
	telegramService := telegram.NewTelegramService(cfg)

	verificationService := telegram.NewVerificationService(
		cfg,
		repoRegistry.UserSettingsRepo,
		repoRegistry.VerificationRepo,
		auditService,
		telegramService,
		approvals.NewService(repoRegistry.VerificationRepo, repoRegistry.UserRepo),
		notifications.NewService(
			telegram.NewNotificationChannel(repoRegistry.UserSettingsRepo, telegramService),
		),
	)
	rebalanceService := rebalance.NewService(
		repoRegistry.PortfolioProfilesRepo,
		repoRegistry.PortfolioRebalancesRepo,
		nil,
		nil,
		auditService,
		rebalance.NewTemporalExecutionStarter(cfg.TemporalAddr, cfg.TemporalNS, cfg.TemporalQueue),
	)
	verificationService.SetRebalanceExecutionExecutor(rebalanceService)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	log.Printf("telegram-bot: starting telegram polling")
	verificationService.StartTelegramPolling(ctx)

	<-ctx.Done()
	log.Printf("telegram-bot: shutdown signal received")
}
