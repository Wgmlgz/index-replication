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
	DatabaseURL  string
	DBUser        string
	DBPassword    string
	DBHost        string
	DBPort        string
	DBName        string
	ServerPort    string
	SessionSecret string
	BotsToken     string
}

func LoadConfig() *Config {
	// Load .env file if exists
	_ = godotenv.Load()
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", ""),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBName:     getEnv("DB_NAME", "postgres"),

		ServerPort:    getEnv("SERVER_PORT", "8080"),
		SessionSecret: getEnv("SESSION_SECRET", "dev_secret"),
		BotsToken:     getEnv("BOTS_TOKEN", "secret_token"),
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
