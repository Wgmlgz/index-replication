package testutil

import (
	"database/sql"
	"fmt"
	"strings"
	"testing"

	"server/internal/migrations"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewTestDB(t *testing.T) (*gorm.DB, func()) {
	t.Helper()

	name := strings.ReplaceAll(t.Name(), "/", "_")
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", name)

	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	// Allow multiple connections to avoid deadlocks in adapters that open transactions
	// while issuing additional Exec calls (e.g., Casbin SavePolicy).
	sqlDB.SetMaxOpenConns(5)

	if err := migrations.Up(sqlDB, migrations.DialectSQLite, ""); err != nil {
		_ = sqlDB.Close()
		t.Fatalf("failed to run migrations: %v", err)
	}

	gormDB, err := gorm.Open(sqlite.Dialector{Conn: sqlDB}, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		_ = sqlDB.Close()
		t.Fatalf("failed to open gorm db: %v", err)
	}

	cleanup := func() {
		_ = sqlDB.Close()
	}

	return gormDB, cleanup
}
