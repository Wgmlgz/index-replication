package main

import (
	"context"
	"log"
	"server/internal/config"
	"server/internal/temporalsetup"

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

	if err := temporalsetup.ApplySchedules(ctx, temporalClient, temporalsetup.ScheduleOptions{
		TaskQueue:               cfg.TemporalQueue,
		TimeZone:                cfg.MoexScheduleTimezone,
		EnableSearchAttributes:  cfg.TemporalEnableSearchAttrs,
		EnableMonthlyDeepResync: cfg.MoexEnableMonthlyDeepResync,
	}); err != nil {
		log.Fatal(err)
	}

	log.Printf("Temporal schedules applied namespace=%s taskQueue=%s", cfg.TemporalNS, cfg.TemporalQueue)
}
