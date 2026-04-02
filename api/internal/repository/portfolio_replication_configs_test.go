package repository

import (
	"errors"
	"testing"

	"server/internal/models"
	"server/internal/testutil"

	"gorm.io/gorm"
)

func TestPortfolioReplicationConfigs_MigrationAndConstraints(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable sqlite foreign keys: %v", err)
	}

	t.Run("table and benchmark index exist", func(t *testing.T) {
		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='portfolio_replication_configs'").Scan(&count).Error; err != nil {
			t.Fatalf("check table exists: %v", err)
		}
		if count != 1 {
			t.Fatalf("expected portfolio_replication_configs table to exist")
		}

		if err := db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_portfolio_replication_configs_benchmark_secid'").Scan(&count).Error; err != nil {
			t.Fatalf("check benchmark index exists: %v", err)
		}
		if count != 1 {
			t.Fatalf("expected benchmark index to exist")
		}
	})

	t.Run("portfolio_profile_id is unique", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 1001)
		seedMoexIndex(t, db, "IMOEX")
		insertReplicationConfigRow(t, db, profileID, strPtr("IMOEX"))

		err := db.Exec(
			"INSERT INTO portfolio_replication_configs (portfolio_profile_id, is_enabled, benchmark_secid, mode_key, mode_params) VALUES (?, ?, ?, ?, ?)",
			profileID,
			true,
			"IMOEX",
			"full",
			"{}",
		).Error
		if err == nil {
			t.Fatalf("expected unique constraint error for duplicate portfolio_profile_id")
		}
	})

	t.Run("fk to portfolio_profiles", func(t *testing.T) {
		seedMoexIndex(t, db, "IRUS")
		err := db.Exec(
			"INSERT INTO portfolio_replication_configs (portfolio_profile_id, is_enabled, benchmark_secid, mode_key, mode_params) VALUES (?, ?, ?, ?, ?)",
			999999,
			true,
			"IRUS",
			"full",
			"{}",
		).Error
		if err == nil {
			t.Fatalf("expected fk violation for missing portfolio_profile_id")
		}
	})

	t.Run("benchmark secid is plain ticker without moex fk", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 1002)
		err := db.Exec(
			"INSERT INTO portfolio_replication_configs (portfolio_profile_id, is_enabled, benchmark_secid, mode_key, mode_params) VALUES (?, ?, ?, ?, ?)",
			profileID,
			true,
			"UNKNOWN",
			"full",
			"{}",
		).Error
		if err != nil {
			t.Fatalf("expected benchmark ticker insert without fk violation, got: %v", err)
		}
	})

	t.Run("cascade delete from portfolio_profiles", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 1003)
		seedMoexIndex(t, db, "RVI")
		insertReplicationConfigRow(t, db, profileID, strPtr("RVI"))

		if err := db.Delete(&models.PortfolioProfile{}, "id = ?", profileID).Error; err != nil {
			t.Fatalf("delete profile: %v", err)
		}

		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM portfolio_replication_configs WHERE portfolio_profile_id = ?", profileID).Scan(&count).Error; err != nil {
			t.Fatalf("count replication configs: %v", err)
		}
		if count != 0 {
			t.Fatalf("expected replication config to be deleted by cascade")
		}
	})
}

func TestPortfolioReplicationConfigsRepository_UpsertAndDelete(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable sqlite foreign keys: %v", err)
	}

	profileID := createPortfolioProfileRow(t, db, 2001)
	seedMoexIndex(t, db, "IMOEX")
	repo := NewPortfolioReplicationConfigsRepository(db)

	created, err := repo.Upsert(&models.PortfolioReplicationConfig{
		PortfolioProfileID: profileID,
		IsEnabled:          true,
		BenchmarkSecid:     strPtr("IMOEX"),
		ModeKey:            "full",
		ModeParams:         map[string]interface{}{"target_count": 15.0},
	})
	if err != nil {
		t.Fatalf("upsert create: %v", err)
	}
	if created.ID <= 0 {
		t.Fatalf("expected created id > 0")
	}

	updated, err := repo.Upsert(&models.PortfolioReplicationConfig{
		PortfolioProfileID: profileID,
		IsEnabled:          false,
		BenchmarkSecid:     strPtr("IMOEX"),
		ModeKey:            "full",
		ModeParams:         map[string]interface{}{"target_count": 10.0},
	})
	if err != nil {
		t.Fatalf("upsert update: %v", err)
	}
	if updated.ID != created.ID {
		t.Fatalf("expected same id after upsert update, got %d and %d", created.ID, updated.ID)
	}
	if updated.ModeKey != "full" {
		t.Fatalf("expected updated mode_key, got %q", updated.ModeKey)
	}

	all, err := repo.ListByPortfolioProfileIDs([]int{profileID})
	if err != nil {
		t.Fatalf("list by profile ids: %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 config, got %d", len(all))
	}

	exists, err := repo.BenchmarkExists("IMOEX")
	if err != nil {
		t.Fatalf("benchmark exists: %v", err)
	}
	if !exists {
		t.Fatalf("expected benchmark IMOEX to exist")
	}

	deleted, err := repo.DeleteByPortfolioProfileID(profileID)
	if err != nil {
		t.Fatalf("delete by profile id: %v", err)
	}
	if !deleted {
		t.Fatalf("expected delete=true")
	}

	_, err = repo.GetByPortfolioProfileID(profileID)
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected record not found after delete, got %v", err)
	}
}

func createPortfolioProfileRow(t *testing.T, db *gorm.DB, userID int) int {
	t.Helper()
	row := &models.PortfolioProfile{
		UserID:     userID,
		Provider:   "mock",
		Name:       "Profile",
		IsDefault:  false,
		ConfigJSON: "{}",
		SecretJSON: "{}",
	}
	if err := db.Create(row).Error; err != nil {
		t.Fatalf("create portfolio profile: %v", err)
	}
	return row.ID
}

func seedMoexIndex(t *testing.T, db *gorm.DB, secid string) {
	t.Helper()
	row := &models.MoexIndexDB{
		Secid:     secid,
		ShortName: secid,
		Name:      secid + " index",
	}
	if err := db.Create(row).Error; err != nil {
		t.Fatalf("seed moex index %s: %v", secid, err)
	}
}

func insertReplicationConfigRow(t *testing.T, db *gorm.DB, profileID int, benchmarkSecid *string) {
	t.Helper()
	if err := db.Exec(
		"INSERT INTO portfolio_replication_configs (portfolio_profile_id, is_enabled, benchmark_secid, mode_key, mode_params) VALUES (?, ?, ?, ?, ?)",
		profileID,
		true,
		benchmarkSecid,
		"full",
		"{}",
	).Error; err != nil {
		t.Fatalf("insert replication config: %v", err)
	}
}

func strPtr(value string) *string {
	return &value
}
