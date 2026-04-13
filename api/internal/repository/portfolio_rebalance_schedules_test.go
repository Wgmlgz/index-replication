package repository

import (
	"errors"
	"testing"
	"time"

	"server/internal/models"
	"server/internal/testutil"

	"gorm.io/gorm"
)

func TestPortfolioRebalanceSchedules_MigrationAndConstraints(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	t.Run("table exists", func(t *testing.T) {
		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portfolio_rebalance_schedules'").Scan(&count).Error; err != nil {
			t.Fatalf("check table exists: %v", err)
		}
		if count != 1 {
			t.Fatalf("expected portfolio_rebalance_schedules table to exist")
		}
	})

	t.Run("portfolio_profile_id is unique", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 3001)
		dtStart := time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC)
		insertRebalanceScheduleRow(t, db, profileID, true, dtStart, "FREQ=DAILY")

		err := db.Exec(
			"INSERT INTO portfolio_rebalance_schedules (portfolio_profile_id, is_enabled, dtstart, rrule) VALUES (?, ?, ?, ?)",
			profileID,
			true,
			dtStart.Format(time.RFC3339),
			"FREQ=WEEKLY;BYDAY=MO",
		).Error
		if err == nil {
			t.Fatalf("expected unique constraint error for duplicate portfolio_profile_id")
		}
	})

	t.Run("fk to portfolio_profiles", func(t *testing.T) {
		err := db.Exec(
			"INSERT INTO portfolio_rebalance_schedules (portfolio_profile_id, is_enabled, dtstart, rrule) VALUES (?, ?, ?, ?)",
			999999,
			true,
			time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC).Format(time.RFC3339),
			"FREQ=DAILY",
		).Error
		if err == nil {
			t.Fatalf("expected fk violation for missing portfolio_profile_id")
		}
	})

	t.Run("cascade delete from portfolio_profiles", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 3002)
		insertRebalanceScheduleRow(
			t,
			db,
			profileID,
			true,
			time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC),
			"FREQ=DAILY",
		)

		if err := db.Delete(&models.PortfolioProfile{}, "id = ?", profileID).Error; err != nil {
			t.Fatalf("delete profile: %v", err)
		}

		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM portfolio_rebalance_schedules WHERE portfolio_profile_id = ?", profileID).Scan(&count).Error; err != nil {
			t.Fatalf("count schedules: %v", err)
		}
		if count != 0 {
			t.Fatalf("expected schedule to be deleted by cascade")
		}
	})
}

func TestPortfolioRebalanceSchedulesRepository_UpsertAndDelete(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	profileID := createPortfolioProfileRow(t, db, 3003)
	repo := NewPortfolioRebalanceSchedulesRepository(db)
	initialStart := time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC)

	created, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID:    profileID,
		IsEnabled:             true,
		DtStart:               initialStart,
		RRule:                 "FREQ=DAILY",
		BusinessDayAdjustment: "strict",
	})
	if err != nil {
		t.Fatalf("upsert create: %v", err)
	}
	if created.ID <= 0 {
		t.Fatalf("expected created id > 0")
	}

	updatedStart := time.Date(2026, 4, 14, 10, 30, 0, 0, time.UTC)
	updated, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID:    profileID,
		IsEnabled:             false,
		DtStart:               updatedStart,
		RRule:                 "FREQ=WEEKLY;BYDAY=TU",
		BusinessDayAdjustment: "modified_following",
	})
	if err != nil {
		t.Fatalf("upsert update: %v", err)
	}
	if updated.ID != created.ID {
		t.Fatalf("expected same id after upsert update, got %d and %d", created.ID, updated.ID)
	}
	if updated.IsEnabled {
		t.Fatalf("expected updated is_enabled=false")
	}
	if updated.RRule != "FREQ=WEEKLY;BYDAY=TU" {
		t.Fatalf("expected updated rrule, got %q", updated.RRule)
	}
	if updated.BusinessDayAdjustment != "modified_following" {
		t.Fatalf("expected updated business_day_adjustment=modified_following, got %q", updated.BusinessDayAdjustment)
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

func insertRebalanceScheduleRow(
	t *testing.T,
	db *gorm.DB,
	profileID int,
	isEnabled bool,
	dtStart time.Time,
	rrule string,
) {
	t.Helper()
	if err := db.Exec(
		"INSERT INTO portfolio_rebalance_schedules (portfolio_profile_id, is_enabled, dtstart, rrule) VALUES (?, ?, ?, ?)",
		profileID,
		isEnabled,
		dtStart.Format(time.RFC3339),
		rrule,
	).Error; err != nil {
		t.Fatalf("insert rebalance schedule: %v", err)
	}
}
