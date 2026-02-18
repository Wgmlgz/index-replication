package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Config struct {
	DatabaseURL                 string
	DBUser                      string
	DBPassword                  string
	DBHost                      string
	DBPort                      string
	DBName                      string
	ServerPort                  string
	SessionSecret               string
	BotsToken                   string
	MoexBaseURL                 string
	MoexMutableDays             int
	MoexImmutableBeforeDate     string
	MoexLiveCurrentDayEnabled   bool
	MoexScheduleTimezone        string
	MoexEnableMonthlyDeepResync bool
	TemporalEnableSearchAttrs   bool
	TemporalAddr                string
	TemporalNS                  string
	TemporalQueue               string
	RunMigrations               bool
	MigrationsDir               string
	GinLogFormat                string
}

func LoadConfig() *Config {
	// Load .env file if exists
	_ = godotenv.Load()
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", ""),
		DBUser:      getEnv("DB_USER", "postgres"),
		DBPassword:  getEnv("DB_PASSWORD", ""),
		DBHost:      getEnv("DB_HOST", "localhost"),
		DBPort:      getEnv("DB_PORT", "5432"),
		DBName:      getEnv("DB_NAME", "postgres"),

		ServerPort:                  getEnv("SERVER_PORT", "8080"),
		SessionSecret:               getEnv("SESSION_SECRET", "dev_secret"),
		BotsToken:                   getEnv("BOTS_TOKEN", "secret_token"),
		MoexBaseURL:                 getEnv("MOEX_BASE_URL", "https://iss.amogos.pro/iss"),
		MoexMutableDays:             getEnvInt("MOEX_MUTABLE_DAYS", 30),
		MoexImmutableBeforeDate:     getEnv("MOEX_IMMUTABLE_BEFORE_DATE", ""),
		MoexLiveCurrentDayEnabled:   getEnvBool("MOEX_LIVE_CURRENT_DAY_ENABLED", false),
		MoexScheduleTimezone:        getEnv("MOEX_SCHEDULE_TIMEZONE", "Europe/Moscow"),
		MoexEnableMonthlyDeepResync: getEnvBool("MOEX_ENABLE_MONTHLY_DEEP_RESYNC", false),
		TemporalEnableSearchAttrs:   getEnvBool("TEMPORAL_ENABLE_SEARCH_ATTRIBUTES", false),
		TemporalAddr:                getEnv("TEMPORAL_ADDRESS", "localhost:7233"),
		TemporalNS:                  getEnv("TEMPORAL_NAMESPACE", "moex-sync"),
		TemporalQueue:               getEnv("TEMPORAL_TASK_QUEUE", "moex-sync"),
		RunMigrations:               getEnvBool("RUN_MIGRATIONS", true),
		MigrationsDir:               getEnv("MIGRATIONS_DIR", ""),
		GinLogFormat:                getEnv("GIN_LOG_FORMAT", ""),
	}
}

func InitDB(cfg *Config) *gorm.DB {
	dsn := cfg.DatabaseURL
	if dsn == "" {
		dsn = fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
			cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		// Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Database connection failed:", err)
	}

	// Test the connection
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("Failed to get underlying sql.DB:", err)
	}

	if err := sqlDB.Ping(); err != nil {
		log.Fatal("Database ping failed:", err)
	}

	return db
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	value, exists := os.LookupEnv(key)
	if !exists || value == "" {
		return defaultValue
	}

	switch value {
	case "1", "true", "TRUE", "True", "yes", "YES", "Yes", "on", "ON", "On":
		return true
	case "0", "false", "FALSE", "False", "no", "NO", "No", "off", "OFF", "Off":
		return false
	default:
		return defaultValue
	}
}

func getEnvInt(key string, defaultValue int) int {
	value, exists := os.LookupEnv(key)
	if !exists || value == "" {
		return defaultValue
	}

	parsed := defaultValue
	if _, err := fmt.Sscanf(value, "%d", &parsed); err != nil {
		return defaultValue
	}
	return parsed
}
