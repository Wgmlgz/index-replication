package testutil

import (
	"database/sql"
	"fmt"
	"strings"
	"testing"

	"server/internal/migrations"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func NewTestDB(t *testing.T) (*gorm.DB, func()) {
	t.Helper()

	name := strings.ReplaceAll(t.Name(), "/", "_")
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", name)

	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	if err := migrations.Up(sqlDB, migrations.DialectSQLite, ""); err != nil {
		_ = sqlDB.Close()
		t.Fatalf("failed to run migrations: %v", err)
	}

	gormDB, err := gorm.Open(sqlite.Dialector{Conn: sqlDB}, &gorm.Config{})
	if err != nil {
		_ = sqlDB.Close()
		t.Fatalf("failed to open gorm db: %v", err)
	}

	cleanup := func() {
		_ = sqlDB.Close()
	}

	return gormDB, cleanup
}
