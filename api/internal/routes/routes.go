package routes

import (
	"context"
	"fmt"
	"log"
	keycloakauth "server/internal/auth"
	"server/internal/config"
	h "server/internal/handlers"
	"server/internal/marketprice"
	m "server/internal/middleware"
	"server/internal/moex"
	"server/internal/portfolio"
	"server/internal/rebalance"
	rebalanceplanner "server/internal/rebalance/planner"
	"server/internal/repository"
	"server/internal/services"
	"server/internal/tbank"
	"server/internal/telegram"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRouter(db *gorm.DB, cfg *config.Config, repoRegistry *repository.RepositoryRegistry, auditService *services.AuditService) *gin.Engine {
	router := gin.New()
	if cfg.GinLogFormat == "short" {
		router.Use(gin.LoggerWithFormatter(shortLogFormatter))
	} else {
		router.Use(gin.Logger())
	}
	router.Use(gin.Recovery())

	// CORS configuration
	router.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return true // Allow ALL origins
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * 60 * 60, // 12 hours
	}))

	// Auth routes
	cs := services.NewCasbinService(db)
	cs.InitializePolicies()
	telegramService := telegram.NewTelegramService(cfg)
	log.Printf(
		"telegram config: enabled=%t bot_username_set=%t poll_timeout_sec=%d",
		telegramService.Enabled(),
		cfg.TelegramBotUsername != "",
		cfg.TelegramPollTimeoutSec,
	)
	verificationService := telegram.NewVerificationService(
		cfg,
		repoRegistry.UserRepo,
		repoRegistry.UserSettingsRepo,
		repoRegistry.VerificationRepo,
		auditService,
		telegramService,
	)
	verificationService.StartTelegramPolling(context.Background())

	keycloakAuth := keycloakauth.NewKeycloakAuthenticator(cfg)
	authHandler := h.NewAuthHandler(db, repoRegistry.UserRepo, auditService)
	settingsHandler := h.NewUserSettingsHandler(repoRegistry.UserSettingsRepo)
	verificationHandler := h.NewVerificationHandler(verificationService)

	// Create API group
	api := router.Group("/api")
	log.Printf("auth mode: keycloak bearer middleware")

	userHandler := h.NewUserHandler(cfg, repoRegistry.UserRepo, cs, auditService)
	auditHandler := h.NewAuditLogHandler(repoRegistry.AuditLogRepo, cfg, cs)
	moexLiveService := moex.NewMoexService(cfg.MoexBaseURL)
	moexReadService := moex.NewMoexReadService(repoRegistry.MoexDataRepo, moexLiveService, cfg.MoexLiveCurrentDayEnabled)
	marketPriceService := marketprice.NewService(
		repoRegistry.MarketPriceRepo,
		repoRegistry.MoexDataRepo,
		repoRegistry.MoexSyncRepo,
		moexLiveService,
	)
	moexHandler := h.NewMoexHandler(moexReadService)
	tickerLogoHandler := h.NewTickerLogoHandler()
	moexSyncAdminHandler := h.NewMoexSyncAdminHandler(repoRegistry.MoexDataRepo)
	tbankService := tbank.NewService(
		tbank.Config{
			TBankInvestGrpcEndpoint:        cfg.TBankInvestGrpcEndpoint,
			TBankInvestSandboxGrpcEndpoint: cfg.TBankInvestSandboxGrpcEndpoint,
			TBankCACertFile:                cfg.TBankCACertFile,
		},
		repoRegistry.UserSettingsRepo,
		auditService,
		marketPriceService,
	)
	tbankHandler := h.NewTBankHandler(tbankService)
	tbankProvider := portfolio.NewTBankProvider(tbankService)
	mockProvider := portfolio.NewMockProvider()
	virtualProvider := portfolio.NewVirtualProvider(repoRegistry.VirtualPortfolioTransactionsRepo, marketPriceService)
	portfolioService := portfolio.NewService(
		repoRegistry.PortfolioProfilesRepo,
		repoRegistry.PortfolioReplicationConfigsRepo,
		auditService,
		tbankProvider,
		mockProvider,
		virtualProvider,
	)
	portfolioHandler := h.NewPortfolioHandler(portfolioService)
	rebalancePlanner := rebalanceplanner.NewService(
		rebalanceplanner.NewRegistry(
			rebalanceplanner.NewFullAlgorithm(),
			rebalanceplanner.NewSampledAlgorithm(),
		),
	)
	rebalanceSnapshotLoader := rebalance.NewSnapshotLoader(
		repoRegistry.PortfolioProfilesRepo,
		repoRegistry.PortfolioReplicationConfigsRepo,
		moexReadService,
		tbankProvider,
		mockProvider,
		virtualProvider,
	)
	rebalanceService := rebalance.NewService(
		repoRegistry.PortfolioProfilesRepo,
		repoRegistry.PortfolioRebalancesRepo,
		rebalanceSnapshotLoader,
		rebalancePlanner,
		auditService,
	)
	portfolioRebalanceHandler := h.NewPortfolioRebalanceHandler(rebalanceService)

	// Protected user routes
	a := api.Group("/")
	a.Use(m.KeycloakJWTAuthMiddleware(keycloakAuth, repoRegistry.UserRepo))
	{
		a.POST("/logout", authHandler.Logout)

		// User management
		a.GET("/me", m.RPM(cs, config.SelfView), userHandler.GetCurrentUser)
		a.GET("/me/settings", m.RPM(cs, config.SelfView), settingsHandler.GetSettings)
		a.PATCH("/me/settings", m.RPM(cs, config.SelfUpdateSettings), settingsHandler.PatchSettings)
		a.GET("/me/tbank", m.RPM(cs, config.SelfView), tbankHandler.GetStatus)
		a.POST("/me/tbank/connect", m.RPM(cs, config.SelfUpdateSettings), tbankHandler.Connect)
		a.POST("/me/tbank/disconnect", m.RPM(cs, config.SelfUpdateSettings), tbankHandler.Disconnect)
		a.POST("/me/tbank/default-account", m.RPM(cs, config.SelfUpdateSettings), tbankHandler.SetDefaultAccount)
		a.GET("/me/tbank/instruments/lookup", m.RPM(cs, config.SelfView), tbankHandler.FindInstrumentByTicker)
		a.GET("/me/portfolios", m.RPM(cs, config.SelfView), portfolioHandler.ListProfiles)
		a.POST("/me/portfolios", m.RPM(cs, config.SelfUpdateSettings), portfolioHandler.CreateProfile)
		a.PATCH("/me/portfolios/:id", m.RPM(cs, config.SelfUpdateSettings), portfolioHandler.PatchProfile)
		a.DELETE("/me/portfolios/:id", m.RPM(cs, config.SelfUpdateSettings), portfolioHandler.DeleteProfile)
		a.PUT("/me/portfolios/:id/replication", m.RPM(cs, config.SelfUpdateSettings), portfolioHandler.UpsertReplicationConfig)
		a.DELETE("/me/portfolios/:id/replication", m.RPM(cs, config.SelfUpdateSettings), portfolioHandler.DeleteReplicationConfig)
		a.POST("/me/portfolios/:id/rebalances", m.RPM(cs, config.SelfUpdateSettings), portfolioRebalanceHandler.CreateRebalanceDraft)
		a.GET("/me/portfolios/:id/rebalances", m.RPM(cs, config.SelfView), portfolioRebalanceHandler.ListRebalances)
		a.GET("/me/portfolios/:id/rebalances/:rebalanceId", m.RPM(cs, config.SelfView), portfolioRebalanceHandler.GetRebalanceDetail)
		a.DELETE("/me/portfolios/:id/rebalances/:rebalanceId", m.RPM(cs, config.SelfUpdateSettings), portfolioRebalanceHandler.DeleteRebalanceDraft)
		a.GET("/me/portfolios/:id/summary", m.RPM(cs, config.SelfView), portfolioHandler.GetSummary)
		a.GET("/me/portfolios/:id/history", m.RPM(cs, config.SelfView), portfolioHandler.GetHistory)
		a.GET("/me/portfolios/:id/composition", m.RPM(cs, config.SelfView), portfolioHandler.GetComposition)
		a.GET("/me/portfolios/:id/composition/series", m.RPM(cs, config.SelfView), portfolioHandler.GetCompositionSeries)
		a.GET("/me/portfolios/:id/operations", m.RPM(cs, config.SelfView), portfolioHandler.GetOperations)
		a.POST("/me/portfolios/:id/actions/:action", m.RPM(cs, config.SelfUpdateSettings), portfolioHandler.RunAction)
		a.GET("/me/verification/telegram", m.RPM(cs, config.SelfView), verificationHandler.GetTelegramStatus)
		a.POST("/me/verification/telegram/connect", m.RPM(cs, config.SelfUpdateSettings), verificationHandler.CreateTelegramConnectLink)
		a.PATCH("/me/verification/telegram", m.RPM(cs, config.SelfUpdateSettings), verificationHandler.PatchTelegramSettings)
		a.DELETE("/me/verification/telegram", m.RPM(cs, config.SelfUpdateSettings), verificationHandler.UnlinkTelegram)
		a.PUT("/me/password", m.RPM(cs, config.SelfUpdatePassword), authHandler.ChangePassword)

		a.GET("/users", m.RPM(cs, config.UsersView), userHandler.ListUsers)
		a.POST("/users", m.RPM(cs, config.UsersCreate), userHandler.CreateUser)
		a.PUT("/users/:id", m.RPM(cs, config.UsersEdit), userHandler.UpdateUser)
		a.GET("/users/:id", m.RPM(cs, config.UsersView), userHandler.GetUser)
		a.POST("/users/:id/block", m.RPM(cs, config.UsersBlock), userHandler.BlockUser)
		a.POST("/users/:id/unblock", m.RPM(cs, config.UsersBlock), userHandler.UnblockUser)
		a.DELETE("/users/:id", m.RPM(cs, config.UsersDelete), userHandler.DeleteUser)

		// Audit log management
		a.GET("/audit-logs", m.RPM(cs, config.AuditLogsView), auditHandler.ListAuditLogs)
		a.GET("/audit-logs/actions", m.RPM(cs, config.AuditLogsView), auditHandler.GetAuditLogActions)
		a.GET("/audit-logs/:id", m.RPM(cs, config.AuditLogsView), auditHandler.GetAuditLog)

		// MOEX data
		a.GET("/moex/indexes/overview", m.RPM(cs, config.MoexView), moexHandler.GetMoexOverview)
		a.GET("/moex/indexes/:secid/history", m.RPM(cs, config.MoexView), moexHandler.GetMoexIndexHistory)
		a.GET("/moex/indexes/:secid/composition", m.RPM(cs, config.MoexView), moexHandler.GetMoexIndexComposition)
		a.GET("/moex/indexes/:secid/composition/series", m.RPM(cs, config.MoexView), moexHandler.GetMoexIndexCompositionSeries)
		a.GET("/tickers/logo", m.RPM(cs, config.SelfView), tickerLogoHandler.ResolveTickerLogo)
		a.GET("/moex/sync/state", m.RPM(cs, config.MoexView), moexSyncAdminHandler.GetMoexSyncState)
		a.GET("/moex/sync/coverage", m.RPM(cs, config.MoexView), moexSyncAdminHandler.GetMoexCoverage)
		a.GET("/moex/sync/runs", m.RPM(cs, config.MoexView), moexSyncAdminHandler.GetMoexSyncRuns)
	}
	return router
}

func shortLogFormatter(param gin.LogFormatterParams) string {
	path := param.Path
	if param.Request != nil && param.Request.URL != nil && param.Request.URL.RawQuery != "" {
		path = fmt.Sprintf("%s?%s", path, param.Request.URL.RawQuery)
	}
	return fmt.Sprintf("[GIN] %3d | %s %s\n", param.StatusCode, param.Method, path)
}
