package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"strings"
	"time"

	"server/internal/config"
	"server/internal/workflows"

	"go.temporal.io/sdk/client"
)

func main() {
	cfg := config.LoadConfig()

	mode := flag.String("mode", "full", "sync mode: full|regular")
	from := flag.String("from", "1997-01-01", "start date (YYYY-MM-DD)")
	till := flag.String("till", "", "end date (YYYY-MM-DD), optional")
	workflowID := flag.String("workflow-id", "", "Temporal workflow ID (optional)")
	flag.Parse()

	normalizedMode := normalizeMode(*mode)
	if normalizedMode == "" {
		log.Fatalf("invalid mode %q: expected full|regular", *mode)
	}

	normalizedFrom, err := normalizeDate(*from, true)
	if err != nil {
		log.Fatalf("invalid from date: %v", err)
	}
	normalizedTill, err := normalizeDate(*till, false)
	if err != nil {
		log.Fatalf("invalid till date: %v", err)
	}

	wid := strings.TrimSpace(*workflowID)
	if wid == "" {
		wid = fmt.Sprintf("moex-backfill-%s", time.Now().UTC().Format("20060102T150405Z"))
	}

	temporalClient, err := client.Dial(client.Options{
		HostPort:  cfg.TemporalAddr,
		Namespace: cfg.TemporalNS,
	})
	if err != nil {
		log.Fatalf("Temporal client connection failed: %v", err)
	}
	defer temporalClient.Close()

	run, err := temporalClient.ExecuteWorkflow(
		context.Background(),
		client.StartWorkflowOptions{
			ID:        wid,
			TaskQueue: cfg.TemporalQueue,
		},
		workflows.DailySyncWorkflow,
		workflows.DailySyncParams{
			Mode:                   normalizedMode,
			From:                   normalizedFrom,
			Till:                   normalizedTill,
			EnableSearchAttributes: cfg.TemporalEnableSearchAttrs,
		},
	)
	if err != nil {
		log.Fatalf("failed to start backfill workflow: %v", err)
	}

	log.Printf(
		"Started workflow type=%s workflowID=%s runID=%s mode=%s from=%s till=%s namespace=%s taskQueue=%s",
		"DailySyncWorkflow",
		run.GetID(),
		run.GetRunID(),
		normalizedMode,
		normalizedFrom,
		normalizedTill,
		cfg.TemporalNS,
		cfg.TemporalQueue,
	)
}

func normalizeMode(value string) string {
	mode := strings.ToLower(strings.TrimSpace(value))
	switch mode {
	case "full", "regular":
		return mode
	default:
		return ""
	}
}

func normalizeDate(value string, required bool) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		if required {
			return "", fmt.Errorf("date is required")
		}
		return "", nil
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return "", err
	}
	return parsed.UTC().Format("2006-01-02"), nil
}
