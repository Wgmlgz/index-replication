package testutil

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"server/internal/migrations"

	testcontainers "github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	gormpostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	postgresInitOnce sync.Once
	postgresInitErr  error
	postgresCtr      *postgres.PostgresContainer
	postgresHost     string
	postgresPort     string
	postgresUser     = "app"
	postgresPassword = "app"
	testDBCounter    uint64

	dbNameSanitizer = regexp.MustCompile(`[^a-z0-9_]+`)
)

func NewTestDB(t *testing.T) (*gorm.DB, func()) {
	t.Helper()

	if err := ensurePostgresContainer(); err != nil {
		t.Fatalf("failed to initialize test postgres container: %v", err)
	}

	dbName := makeTestDBName(t.Name())
	if err := createDatabase(dbName); err != nil {
		t.Fatalf("failed to create test database %q: %v", dbName, err)
	}

	gormDB, sqlDB, err := openGormDB(dbName)
	if err != nil {
		t.Fatalf("failed to connect to test database %q: %v", dbName, err)
	}

	if err := migrations.Up(sqlDB, ""); err != nil {
		_ = sqlDB.Close()
		t.Fatalf("failed to run migrations: %v", err)
	}

	cleanup := func() {
		_ = sqlDB.Close()
		_ = dropDatabase(dbName)
	}

	return gormDB, cleanup
}

func ensurePostgresContainer() error {
	postgresInitOnce.Do(func() {
		ctx := context.Background()
		ctr, err := postgres.Run(
			ctx,
			"postgres:16-alpine",
			postgres.WithDatabase("postgres"),
			postgres.WithUsername(postgresUser),
			postgres.WithPassword(postgresPassword),
			testcontainers.WithWaitStrategy(
				wait.ForLog("database system is ready to accept connections").
					WithOccurrence(2).
					WithStartupTimeout(2*time.Minute),
			),
		)
		if err != nil {
			postgresInitErr = err
			return
		}

		host, err := ctr.Host(ctx)
		if err != nil {
			postgresInitErr = err
			return
		}
		port, err := ctr.MappedPort(ctx, "5432/tcp")
		if err != nil {
			postgresInitErr = err
			return
		}

		postgresCtr = ctr
		postgresHost = host
		postgresPort = port.Port()
	})

	return postgresInitErr
}

func makeTestDBName(testName string) string {
	base := strings.ToLower(strings.TrimSpace(testName))
	base = strings.ReplaceAll(base, "/", "_")
	base = dbNameSanitizer.ReplaceAllString(base, "_")
	base = strings.Trim(base, "_")
	if base == "" {
		base = "db"
	}

	seq := atomic.AddUint64(&testDBCounter, 1)
	name := fmt.Sprintf("test_%s_%d", base, seq)
	if len(name) <= 63 {
		return name
	}

	suffix := fmt.Sprintf("_%d", seq)
	maxBaseLen := 63 - len("test__") - len(suffix)
	if maxBaseLen < 1 {
		maxBaseLen = 1
	}
	if len(base) > maxBaseLen {
		base = base[:maxBaseLen]
	}
	return fmt.Sprintf("test_%s%s", base, suffix)
}

func createDatabase(name string) error {
	_, adminSQL, err := openAdminDB()
	if err != nil {
		return err
	}
	defer adminSQL.Close()

	_, err = adminSQL.Exec(fmt.Sprintf(`CREATE DATABASE "%s"`, name))
	return err
}

func dropDatabase(name string) error {
	_, adminSQL, err := openAdminDB()
	if err != nil {
		return err
	}
	defer adminSQL.Close()

	_, _ = adminSQL.Exec(
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
		name,
	)
	_, err = adminSQL.Exec(fmt.Sprintf(`DROP DATABASE IF EXISTS "%s"`, name))
	return err
}

func openAdminDB() (*gorm.DB, *sql.DB, error) {
	return openGormDB("postgres")
}

func openGormDB(dbName string) (*gorm.DB, *sql.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=UTC",
		postgresHost,
		postgresPort,
		postgresUser,
		postgresPassword,
		dbName,
	)

	gormDB, err := gorm.Open(gormpostgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, nil, err
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		return nil, nil, err
	}

	return gormDB, sqlDB, nil
}
