package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"index-replication/api/internal/api"
	"index-replication/api/internal/auth"
	"index-replication/api/internal/db"
	"index-replication/api/internal/handler"
)

func main() {
	port := getEnv("PORT", "30000")
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	accessTTL := parseDuration("ACCESS_TOKEN_TTL", "15m")
	refreshTTL := parseDuration("REFRESH_TOKEN_TTL", "168h")
	cookieSecure := parseBool("COOKIE_SECURE", false)
	cookieDomain := os.Getenv("COOKIE_DOMAIN")
	corsOrigins := parseCSV(getEnv("CORS_ORIGINS", "http://app123.localhost"))

	if parseBool("RUN_MIGRATIONS", true) {
		migrationsDir := getEnv("MIGRATIONS_DIR", "./migrations")
		if err := runMigrations(databaseURL, migrationsDir); err != nil {
			log.Fatalf("migrations failed: %v", err)
		}
	}

	gormDB, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("db connect failed: %v", err)
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		log.Fatalf("db init failed: %v", err)
	}
	defer sqlDB.Close()

	store := db.NewStore(gormDB)
	jwtManager := auth.NewManager([]byte(jwtSecret), accessTTL, refreshTTL, "index-replication")
	srv := handler.NewServer(store, jwtManager, handler.Config{
		CookieDomain: cookieDomain,
		CookieSecure: cookieSecure,
	})

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowCredentials: true,
		MaxAge:           5 * time.Minute,
	}))

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy"})
	})

	api.RegisterHandlersWithOptions(router, srv, api.GinServerOptions{
		ErrorHandler: func(c *gin.Context, err error, statusCode int) {
			handler.WriteError(c, statusCode, "invalid request")
		},
	})

	addr := ":" + port
	log.Printf("listening on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatal(err)
	}
}

func runMigrations(databaseURL, migrationsDir string) error {
	dbConn, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return err
	}
	defer dbConn.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	return goose.Up(dbConn, migrationsDir)
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseDuration(key, fallback string) time.Duration {
	value := getEnv(key, fallback)
	d, err := time.ParseDuration(value)
	if err != nil {
		log.Fatalf("invalid duration for %s: %v", key, err)
	}
	return d
}

func parseBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		log.Fatalf("invalid bool for %s: %v", key, err)
	}
	return parsed
}

func parseCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
