package main

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type config struct {
	temporalAddress                string
	temporalNamespace              string
	temporalTaskQueue              string
	temporalEnableSearchAttributes bool
	moexScheduleTimezone           string
	moexEnableMonthlyDeepResync    bool
}

func loadConfig() config {
	_ = godotenv.Load()

	return config{
		temporalAddress:                getEnv("TEMPORAL_ADDRESS", "localhost:7233"),
		temporalNamespace:              getEnv("TEMPORAL_NAMESPACE", "moex-sync"),
		temporalTaskQueue:              getEnv("TEMPORAL_TASK_QUEUE", "moex-sync"),
		temporalEnableSearchAttributes: getEnvBool("TEMPORAL_ENABLE_SEARCH_ATTRIBUTES", false),
		moexScheduleTimezone:           getEnv("MOEX_SCHEDULE_TIMEZONE", "Europe/Moscow"),
		moexEnableMonthlyDeepResync:    getEnvBool("MOEX_ENABLE_MONTHLY_DEEP_RESYNC", false),
	}
}

func getEnv(key, fallback string) string {
	value, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func getEnvBool(key string, fallback bool) bool {
	value, ok := os.LookupEnv(key)
	if !ok || value == "" {
		return fallback
	}

	switch value {
	case "1", "true", "TRUE", "True", "yes", "YES", "Yes", "on", "ON", "On":
		return true
	case "0", "false", "FALSE", "False", "no", "NO", "No", "off", "OFF", "Off":
		return false
	default:
		return fallback
	}
}
