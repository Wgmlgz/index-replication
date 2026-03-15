package config

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Config struct {
	DatabaseURL                    string
	DBUser                         string
	DBPassword                     string
	DBHost                         string
	DBPort                         string
	DBName                         string
	ServerPort                     string
	SessionSecret                  string
	SessionCookieSecure            bool
	SessionCookieDomain            string
	SessionCookiePath              string
	SessionCookieSameSite          string
	KeycloakAuthEnabled            bool
	KeycloakBaseURL                string
	KeycloakRealm                  string
	KeycloakIssuerURL              string
	KeycloakClientID               string
	KeycloakSkipIssuerCheck        bool
	KeycloakSkipClientIDCheck      bool
	BotsToken                      string
	TelegramBotToken               string
	TelegramBotUsername            string
	TelegramPollTimeoutSec         int
	LoginVerificationTTLSeconds    int
	MoexBaseURL                    string
	MoexMutableDays                int
	MoexImmutableBeforeDate        string
	MoexLiveCurrentDayEnabled      bool
	MoexScheduleTimezone           string
	MoexEnableMonthlyDeepResync    bool
	TBankInvestGrpcEndpoint        string
	TBankInvestSandboxGrpcEndpoint string
	TBankCACertFile                string
	TemporalEnableSearchAttrs      bool
	TemporalAddr                   string
	TemporalNS                     string
	TemporalQueue                  string
	RunMigrations                  bool
	MigrationsDir                  string
	GinLogFormat                   string
}

func LoadConfig() *Config {
	// Load .env file if exists
	_ = godotenv.Load()

	keycloakRealm := getEnvNonEmpty("KEYCLOAK_REALM", "index-replication")
	keycloakBaseURL := strings.TrimRight(getEnvNonEmpty("KEYCLOAK_BASE_URL", "http://localhost:18081/auth"), "/")
	keycloakIssuerURL := getEnvNonEmpty("KEYCLOAK_ISSUER_URL", fmt.Sprintf("%s/realms/%s", keycloakBaseURL, keycloakRealm))

	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", ""),
		DBUser:      getEnv("DB_USER", "postgres"),
		DBPassword:  getEnv("DB_PASSWORD", ""),
		DBHost:      getEnv("DB_HOST", "localhost"),
		DBPort:      getEnv("DB_PORT", "5432"),
		DBName:      getEnv("DB_NAME", "postgres"),

		ServerPort:                     getEnv("SERVER_PORT", "8080"),
		SessionSecret:                  getEnv("SESSION_SECRET", "dev_secret"),
		SessionCookieSecure:            getEnvBool("SESSION_COOKIE_SECURE", false),
		SessionCookieDomain:            getEnv("SESSION_COOKIE_DOMAIN", ""),
		SessionCookiePath:              getEnv("SESSION_COOKIE_PATH", "/"),
		SessionCookieSameSite:          getEnv("SESSION_COOKIE_SAME_SITE", "lax"),
		KeycloakAuthEnabled:            getEnvBool("KEYCLOAK_AUTH_ENABLED", true),
		KeycloakBaseURL:                keycloakBaseURL,
		KeycloakRealm:                  keycloakRealm,
		KeycloakIssuerURL:              keycloakIssuerURL,
		KeycloakClientID:               getEnv("KEYCLOAK_CLIENT_ID", ""),
		KeycloakSkipIssuerCheck:        getEnvBool("KEYCLOAK_SKIP_ISSUER_CHECK", true),
		KeycloakSkipClientIDCheck:      getEnvBool("KEYCLOAK_SKIP_CLIENT_ID_CHECK", true),
		BotsToken:                      getEnv("BOTS_TOKEN", "secret_token"),
		TelegramBotToken:               getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramBotUsername:            getEnv("TELEGRAM_BOT_USERNAME", ""),
		TelegramPollTimeoutSec:         getEnvInt("TELEGRAM_POLL_TIMEOUT_SEC", 30),
		LoginVerificationTTLSeconds:    getEnvInt("LOGIN_VERIFICATION_TTL_SECONDS", 300),
		MoexBaseURL:                    getEnv("MOEX_BASE_URL", "https://iss.amogos.pro/iss"),
		MoexMutableDays:                getEnvInt("MOEX_MUTABLE_DAYS", 30),
		MoexImmutableBeforeDate:        getEnv("MOEX_IMMUTABLE_BEFORE_DATE", ""),
		MoexLiveCurrentDayEnabled:      getEnvBool("MOEX_LIVE_CURRENT_DAY_ENABLED", false),
		MoexScheduleTimezone:           getEnv("MOEX_SCHEDULE_TIMEZONE", "Europe/Moscow"),
		MoexEnableMonthlyDeepResync:    getEnvBool("MOEX_ENABLE_MONTHLY_DEEP_RESYNC", false),
		TBankInvestGrpcEndpoint:        getEnv("TBANK_INVEST_GRPC_ENDPOINT", "invest-public-api.tbank.ru:443"),
		TBankInvestSandboxGrpcEndpoint: getEnv("TBANK_INVEST_SANDBOX_GRPC_ENDPOINT", "sandbox-invest-public-api.tbank.ru:443"),
		TBankCACertFile:                getEnvNonEmpty("TBANK_CA_CERT_FILE", defaultTBankCACertFile()),
		TemporalEnableSearchAttrs:      getEnvBool("TEMPORAL_ENABLE_SEARCH_ATTRIBUTES", false),
		TemporalAddr:                   getEnv("TEMPORAL_ADDRESS", "localhost:7233"),
		TemporalNS:                     getEnv("TEMPORAL_NAMESPACE", "moex-sync"),
		TemporalQueue:                  getEnv("TEMPORAL_TASK_QUEUE", "moex-sync"),
		RunMigrations:                  getEnvBool("RUN_MIGRATIONS", true),
		MigrationsDir:                  getEnv("MIGRATIONS_DIR", ""),
		GinLogFormat:                   getEnv("GIN_LOG_FORMAT", ""),
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

func getEnvNonEmpty(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return defaultValue
}

func defaultTBankCACertFile() string {
	candidates := []string{
		"./certs/tbank-root-ca.pem",
		"/root/certs/tbank-root-ca.pem",
		"/app/certs/tbank-root-ca.pem",
		"../api/certs/tbank-root-ca.pem",
	}

	for _, path := range candidates {
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() {
			return path
		}
	}

	return ""
}
