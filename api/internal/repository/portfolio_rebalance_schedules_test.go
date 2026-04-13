package repository

import (
	"context"
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

	t.Run("runtime columns exist", func(t *testing.T) {
		var count int64
		if err := db.Raw(`
			SELECT COUNT(*)
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = 'portfolio_rebalance_schedules'
			  AND column_name IN ('next_run_at', 'last_run_at', 'last_error', 'last_run_id')
		`).Scan(&count).Error; err != nil {
			t.Fatalf("check runtime columns exist: %v", err)
		}
		if count != 4 {
			t.Fatalf("expected 4 runtime columns, got %d", count)
		}
	})

	t.Run("enabled/next_run_at consistency check exists", func(t *testing.T) {
		var count int64
		if err := db.Raw(`
			SELECT COUNT(*)
			FROM information_schema.check_constraints
			WHERE constraint_schema = 'public'
			  AND constraint_name = 'portfolio_rebalance_schedules_enabled_next_run_consistency_chk'
		`).Scan(&count).Error; err != nil {
			t.Fatalf("check enabled/next_run_at consistency constraint exists: %v", err)
		}
		if count != 1 {
			t.Fatalf("expected enabled/next_run_at consistency constraint to exist")
		}
	})

	t.Run("portfolio_profile_id is unique", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 3001)
		dtStart := time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC)
		insertRebalanceScheduleRow(t, db, profileID, true, dtStart, "FREQ=DAILY", nil, nil, nil, nil)

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
		nextRunAt := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
		insertRebalanceScheduleRow(
			t,
			db,
			profileID,
			true,
			time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC),
			"FREQ=DAILY",
			&nextRunAt,
			nil,
			nil,
			nil,
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

	t.Run("enabled schedule rejects null next_run_at", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 3005)
		err := db.Exec(
			"INSERT INTO portfolio_rebalance_schedules (portfolio_profile_id, is_enabled, dtstart, rrule, next_run_at) VALUES (?, ?, ?, ?, ?)",
			profileID,
			true,
			time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC).Format(time.RFC3339),
			"FREQ=DAILY",
			nil,
		).Error
		if err == nil {
			t.Fatalf("expected check violation for enabled schedule with null next_run_at")
		}
	})

	t.Run("disabled schedule rejects non-null next_run_at", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 3006)
		err := db.Exec(
			"INSERT INTO portfolio_rebalance_schedules (portfolio_profile_id, is_enabled, dtstart, rrule, next_run_at) VALUES (?, ?, ?, ?, ?)",
			profileID,
			false,
			time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC).Format(time.RFC3339),
			"FREQ=DAILY",
			time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC).Format(time.RFC3339),
		).Error
		if err == nil {
			t.Fatalf("expected check violation for disabled schedule with non-null next_run_at")
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

func TestPortfolioRebalanceSchedulesRepository_RuntimeStateUpdates(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	profileID := createPortfolioProfileRow(t, db, 3004)
	repo := NewPortfolioRebalanceSchedulesRepository(db)

	created, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID:    profileID,
		IsEnabled:             true,
		DtStart:               time.Date(2026, 4, 13, 9, 30, 0, 0, time.UTC),
		RRule:                 "FREQ=DAILY",
		BusinessDayAdjustment: "strict",
	})
	if err != nil {
		t.Fatalf("upsert create: %v", err)
	}

	nextRunAt := time.Date(2026, 4, 14, 10, 0, 0, 0, time.UTC)
	lastRunAt := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
	lastError := "temporary failure"
	lastRunID := 77

	if err := repo.SetNextRunAtByPortfolioProfileID(profileID, &nextRunAt); err != nil {
		t.Fatalf("set next run at: %v", err)
	}
	if err := repo.SetLastRunAtByPortfolioProfileID(profileID, &lastRunAt); err != nil {
		t.Fatalf("set last run at: %v", err)
	}
	if err := repo.SetLastErrorByPortfolioProfileID(profileID, &lastError); err != nil {
		t.Fatalf("set last error: %v", err)
	}
	if err := repo.SetLastRunIDByPortfolioProfileID(profileID, &lastRunID); err != nil {
		t.Fatalf("set last run id: %v", err)
	}

	updated, err := repo.GetByPortfolioProfileID(profileID)
	if err != nil {
		t.Fatalf("get after runtime update: %v", err)
	}
	if updated.NextRunAt == nil || !updated.NextRunAt.Equal(nextRunAt) {
		t.Fatalf("expected next_run_at=%s, got %v", nextRunAt.Format(time.RFC3339), updated.NextRunAt)
	}
	if updated.LastRunAt == nil || !updated.LastRunAt.Equal(lastRunAt) {
		t.Fatalf("expected last_run_at=%s, got %v", lastRunAt.Format(time.RFC3339), updated.LastRunAt)
	}
	if updated.LastError == nil || *updated.LastError != lastError {
		t.Fatalf("expected last_error=%q, got %v", lastError, updated.LastError)
	}
	if updated.LastRunID == nil || *updated.LastRunID != lastRunID {
		t.Fatalf("expected last_run_id=%d, got %v", lastRunID, updated.LastRunID)
	}

	if err := repo.SetLastErrorByPortfolioProfileID(profileID, nil); err != nil {
		t.Fatalf("clear last error: %v", err)
	}
	if err := repo.SetLastRunIDByPortfolioProfileID(profileID, nil); err != nil {
		t.Fatalf("clear last run id: %v", err)
	}

	cleared, err := repo.GetByPortfolioProfileID(profileID)
	if err != nil {
		t.Fatalf("get after runtime clear: %v", err)
	}
	if cleared.LastError != nil {
		t.Fatalf("expected last_error to be cleared, got %v", cleared.LastError)
	}
	if cleared.LastRunID != nil {
		t.Fatalf("expected last_run_id to be cleared, got %v", cleared.LastRunID)
	}

	updatedStart := time.Date(2026, 4, 14, 10, 30, 0, 0, time.UTC)
	if _, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID:    profileID,
		IsEnabled:             false,
		DtStart:               updatedStart,
		RRule:                 "FREQ=WEEKLY;BYDAY=TU",
		BusinessDayAdjustment: "modified_following",
	}); err != nil {
		t.Fatalf("upsert update with runtime state: %v", err)
	}

	preserved, err := repo.GetByPortfolioProfileID(profileID)
	if err != nil {
		t.Fatalf("get after upsert preserve: %v", err)
	}
	if preserved.NextRunAt != nil {
		t.Fatalf("expected next_run_at=nil for disabled schedule, got %v", preserved.NextRunAt)
	}
	if preserved.LastRunAt == nil || !preserved.LastRunAt.Equal(lastRunAt) {
		t.Fatalf("expected last_run_at to survive upsert, got %v", preserved.LastRunAt)
	}
	if preserved.LastError != nil {
		t.Fatalf("expected last_error to survive upsert, got %v", preserved.LastError)
	}
	if preserved.LastRunID != nil {
		t.Fatalf("expected last_run_id to survive upsert as null, got %v", preserved.LastRunID)
	}
	if preserved.ID != created.ID {
		t.Fatalf("expected same id after upsert update, got %d and %d", created.ID, preserved.ID)
	}
}

func TestPortfolioRebalanceSchedulesRepository_SetNextRunAtUpdatesOnlyNextRunAt(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	profileID := createPortfolioProfileRow(t, db, 3010)
	repo := NewPortfolioRebalanceSchedulesRepository(db)

	_, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profileID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}

	lastRunAt := time.Date(2026, 4, 12, 10, 0, 0, 0, time.UTC)
	lastError := "seeded error"
	lastRunID := 101
	if err := repo.SetLastRunAtByPortfolioProfileID(profileID, &lastRunAt); err != nil {
		t.Fatalf("seed last_run_at: %v", err)
	}
	if err := repo.SetLastErrorByPortfolioProfileID(profileID, &lastError); err != nil {
		t.Fatalf("seed last_error: %v", err)
	}
	if err := repo.SetLastRunIDByPortfolioProfileID(profileID, &lastRunID); err != nil {
		t.Fatalf("seed last_run_id: %v", err)
	}

	nextRunAt := time.Date(2026, 4, 15, 10, 0, 0, 0, time.UTC)
	if err := repo.SetNextRunAtByPortfolioProfileID(profileID, &nextRunAt); err != nil {
		t.Fatalf("set next_run_at: %v", err)
	}

	updated, err := repo.GetByPortfolioProfileID(profileID)
	if err != nil {
		t.Fatalf("get updated schedule: %v", err)
	}
	if updated.NextRunAt == nil || !updated.NextRunAt.Equal(nextRunAt) {
		t.Fatalf("expected next_run_at=%s, got %v", nextRunAt.Format(time.RFC3339), updated.NextRunAt)
	}
	if updated.LastRunAt == nil || !updated.LastRunAt.Equal(lastRunAt) {
		t.Fatalf("expected last_run_at unchanged, got %v", updated.LastRunAt)
	}
	if updated.LastError == nil || *updated.LastError != lastError {
		t.Fatalf("expected last_error unchanged, got %v", updated.LastError)
	}
	if updated.LastRunID == nil || *updated.LastRunID != lastRunID {
		t.Fatalf("expected last_run_id unchanged, got %v", updated.LastRunID)
	}
}

func TestPortfolioRebalanceSchedulesRepository_ListEnabled(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	enabledProfileID := createPortfolioProfileRow(t, db, 3020)
	disabledProfileID := createPortfolioProfileRow(t, db, 3021)
	missingReplicationProfileID := createPortfolioProfileRow(t, db, 3022)
	repo := NewPortfolioRebalanceSchedulesRepository(db)

	insertReplicationConfigRow(t, db, enabledProfileID, nil)
	insertReplicationConfigRow(t, db, disabledProfileID, nil)
	if err := db.Exec(
		"UPDATE portfolio_replication_configs SET is_enabled = ? WHERE portfolio_profile_id = ?",
		false,
		disabledProfileID,
	).Error; err != nil {
		t.Fatalf("disable replication config: %v", err)
	}

	_, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: enabledProfileID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed enabled schedule: %v", err)
	}
	_, err = repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: disabledProfileID,
		IsEnabled:          false,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed disabled schedule: %v", err)
	}
	_, err = repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: missingReplicationProfileID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed enabled schedule without replication config: %v", err)
	}

	rows, err := repo.ListEnabled()
	if err != nil {
		t.Fatalf("list enabled schedules: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 enabled schedule, got %d", len(rows))
	}
	if rows[0].PortfolioProfileID != enabledProfileID {
		t.Fatalf("expected enabled profile id %d, got %d", enabledProfileID, rows[0].PortfolioProfileID)
	}
}

func TestPortfolioRebalanceSchedulesRepository_ClaimDueAndAdvanceNextRunIdempotent(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	profileID := createPortfolioProfileRow(t, db, 3030)
	repo := NewPortfolioRebalanceSchedulesRepository(db)

	schedule, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profileID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY;COUNT=2",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}
	dueAt := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
	nextDueAt := time.Date(2026, 4, 14, 10, 0, 0, 0, time.UTC)
	if err := repo.SetNextRunAtByPortfolioProfileID(profileID, &dueAt); err != nil {
		t.Fatalf("seed next_run_at: %v", err)
	}

	claimed, err := repo.ClaimDueAndAdvanceNextRun(context.Background(), schedule.ID, profileID, dueAt, &nextDueAt)
	if err != nil {
		t.Fatalf("claim due: %v", err)
	}
	if !claimed {
		t.Fatalf("expected first claim=true")
	}

	updated, err := repo.GetByID(schedule.ID)
	if err != nil {
		t.Fatalf("get after claim: %v", err)
	}
	if updated.NextRunAt == nil || !updated.NextRunAt.Equal(nextDueAt) {
		t.Fatalf("expected next_run_at advanced to %s, got %v", nextDueAt.Format(time.RFC3339), updated.NextRunAt)
	}

	claimedAgain, err := repo.ClaimDueAndAdvanceNextRun(context.Background(), schedule.ID, profileID, dueAt, nil)
	if err != nil {
		t.Fatalf("second claim due: %v", err)
	}
	if claimedAgain {
		t.Fatalf("expected second claim=false for same due_at")
	}
}

func TestPortfolioRebalanceSchedulesRepository_ClaimDueWithoutNextRunDisablesSchedule(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	profileID := createPortfolioProfileRow(t, db, 3032)
	repo := NewPortfolioRebalanceSchedulesRepository(db)

	schedule, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profileID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY;COUNT=1",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}
	dueAt := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
	if err := repo.SetNextRunAtByPortfolioProfileID(profileID, &dueAt); err != nil {
		t.Fatalf("seed next_run_at: %v", err)
	}

	claimed, err := repo.ClaimDueAndAdvanceNextRun(context.Background(), schedule.ID, profileID, dueAt, nil)
	if err != nil {
		t.Fatalf("claim terminal due: %v", err)
	}
	if !claimed {
		t.Fatalf("expected claim=true")
	}

	updated, err := repo.GetByID(schedule.ID)
	if err != nil {
		t.Fatalf("get updated schedule: %v", err)
	}
	if updated.IsEnabled {
		t.Fatalf("expected schedule to be disabled when next_run_at is nil")
	}
	if updated.NextRunAt != nil {
		t.Fatalf("expected next_run_at=nil after disabling, got %v", updated.NextRunAt)
	}
}

func TestPortfolioRebalanceSchedulesRepository_MarkDispatchPlanningRuntimeFields(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	profileID := createPortfolioProfileRow(t, db, 3031)
	repo := NewPortfolioRebalanceSchedulesRepository(db)

	schedule, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profileID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}

	seedLastRunAt := time.Date(2026, 4, 10, 10, 0, 0, 0, time.UTC)
	seedLastRunID := 91
	if err := repo.SetLastRunAtByPortfolioProfileID(profileID, &seedLastRunAt); err != nil {
		t.Fatalf("seed last_run_at: %v", err)
	}
	if err := repo.SetLastRunIDByPortfolioProfileID(profileID, &seedLastRunID); err != nil {
		t.Fatalf("seed last_run_id: %v", err)
	}

	if err := repo.MarkDispatchPlanningFailure(context.Background(), schedule.ID, "planning enqueue failed"); err != nil {
		t.Fatalf("mark dispatch failure: %v", err)
	}

	failed, err := repo.GetByID(schedule.ID)
	if err != nil {
		t.Fatalf("get after failure: %v", err)
	}
	if failed.LastRunAt == nil || !failed.LastRunAt.Equal(seedLastRunAt) {
		t.Fatalf("expected last_run_at unchanged on failure, got %v", failed.LastRunAt)
	}
	if failed.LastRunID == nil || *failed.LastRunID != seedLastRunID {
		t.Fatalf("expected last_run_id unchanged on failure, got %v", failed.LastRunID)
	}
	if failed.LastError == nil || *failed.LastError != "planning enqueue failed" {
		t.Fatalf("expected last_error to be set, got %v", failed.LastError)
	}

	dueAt := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
	if err := repo.MarkDispatchPlanningSuccess(context.Background(), schedule.ID, dueAt, 777); err != nil {
		t.Fatalf("mark dispatch success: %v", err)
	}

	succeeded, err := repo.GetByID(schedule.ID)
	if err != nil {
		t.Fatalf("get after success: %v", err)
	}
	if succeeded.LastRunAt == nil || !succeeded.LastRunAt.Equal(dueAt) {
		t.Fatalf("expected last_run_at=%s, got %v", dueAt.Format(time.RFC3339), succeeded.LastRunAt)
	}
	if succeeded.LastRunID == nil || *succeeded.LastRunID != 777 {
		t.Fatalf("expected last_run_id=777, got %v", succeeded.LastRunID)
	}
	if succeeded.LastError != nil {
		t.Fatalf("expected last_error cleared on success, got %v", succeeded.LastError)
	}
}

func insertRebalanceScheduleRow(
	t *testing.T,
	db *gorm.DB,
	profileID int,
	isEnabled bool,
	dtStart time.Time,
	rrule string,
	nextRunAt *time.Time,
	lastRunAt *time.Time,
	lastError *string,
	lastRunID *int,
) {
	t.Helper()
	nextRunAtValue := nextRunAt
	if isEnabled && nextRunAtValue == nil {
		dtStartUTC := dtStart.UTC()
		nextRunAtValue = &dtStartUTC
	}
	if !isEnabled {
		nextRunAtValue = nil
	}
	if err := db.Exec(
		"INSERT INTO portfolio_rebalance_schedules (portfolio_profile_id, is_enabled, dtstart, rrule, next_run_at, last_run_at, last_error, last_run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		profileID,
		isEnabled,
		dtStart.Format(time.RFC3339),
		rrule,
		nextRunAtValue,
		lastRunAt,
		lastError,
		lastRunID,
	).Error; err != nil {
		t.Fatalf("insert rebalance schedule: %v", err)
	}
}
