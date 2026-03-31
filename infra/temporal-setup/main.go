package main

import (
	"context"
	"log"
	"time"
)

func main() {
	cfg := loadConfig()

	if err := runSetup(context.Background(), setupOptions{
		address:                 cfg.temporalAddress,
		namespace:               cfg.temporalNamespace,
		taskQueue:               cfg.temporalTaskQueue,
		timeZone:                cfg.moexScheduleTimezone,
		enableSearchAttributes:  cfg.temporalEnableSearchAttributes,
		enableMonthlyDeepResync: cfg.moexEnableMonthlyDeepResync,
		namespaceRetentionDays:  3,
		waitTimeout:             2 * time.Minute,
		waitInterval:            3 * time.Second,
	}); err != nil {
		log.Fatalf("Temporal setup failed: %v", err)
	}

	log.Printf(
		"Temporal setup complete namespace=%s taskQueue=%s",
		cfg.temporalNamespace,
		cfg.temporalTaskQueue,
	)
}
