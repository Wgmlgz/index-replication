package main

import (
	"context"
	"log"
	"server/internal/config"
	"server/internal/temporalsetup"
	"time"
)

func main() {
	cfg := config.LoadConfig()

	if err := temporalsetup.Run(context.Background(), temporalsetup.SetupOptions{
		Address:                 cfg.TemporalAddr,
		Namespace:               cfg.TemporalNS,
		TaskQueue:               cfg.TemporalQueue,
		TimeZone:                cfg.MoexScheduleTimezone,
		EnableSearchAttributes:  cfg.TemporalEnableSearchAttrs,
		EnableMonthlyDeepResync: cfg.MoexEnableMonthlyDeepResync,
		NamespaceRetentionDays:  3,
		WaitTimeout:             2 * time.Minute,
		WaitInterval:            3 * time.Second,
	}); err != nil {
		log.Fatalf("Temporal setup failed: %v", err)
	}

	log.Printf("Temporal setup complete namespace=%s taskQueue=%s", cfg.TemporalNS, cfg.TemporalQueue)
}
