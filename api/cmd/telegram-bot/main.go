package main

import (
	"context"
	"log"
	"os/signal"
	"server/internal/config"
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

	verificationService := telegram.NewVerificationService(
		cfg,
		repoRegistry.UserRepo,
		repoRegistry.UserSettingsRepo,
		repoRegistry.VerificationRepo,
		auditService,
		telegram.NewTelegramService(cfg),
	)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	log.Printf("telegram-bot: starting telegram polling")
	verificationService.StartTelegramPolling(ctx)

	<-ctx.Done()
	log.Printf("telegram-bot: shutdown signal received")
}
