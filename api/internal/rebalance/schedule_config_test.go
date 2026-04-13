package rebalance

import (
	"context"
	"testing"
	"time"

	"server/internal/api/dto"
	"server/internal/isdayoff"
	"server/internal/models"
	"server/internal/repository"
	"server/internal/testutil"

	"gorm.io/gorm"
)

func TestScheduleConfigService_UpsertEnabledSetsNextRunAtAndKeepsLastRuntimeFields(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	dayoffServer := newIsDayOffMockServer(t, map[string]string{
		"2026-04-13": "0",
	})
	defer dayoffServer.Close()

	userID := 5
	profile := createScheduleConfigTestProfile(t, db, userID, "enabled runtime state")

	profilesRepo := repository.NewPortfolioProfilesRepository(db)
	schedulesRepo := repository.NewPortfolioRebalanceSchedulesRepository(db)
	runtimeState := NewScheduleRuntimeStateService(
		schedulesRepo,
		nil,
		isdayoff.NewService(dayoffServer.URL),
		"UTC",
	)
	runtimeState.now = func() time.Time {
		return time.Date(2026, 4, 13, 9, 0, 0, 0, time.UTC)
	}
	service := NewScheduleConfigService(profilesRepo, schedulesRepo, runtimeState)

	_, err := schedulesRepo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profile.ID,
		IsEnabled:          false,
		DtStart:            time.Date(2026, 4, 12, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY;COUNT=1",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}

	lastRunAt := time.Date(2026, 4, 11, 10, 0, 0, 0, time.UTC)
	lastError := "seeded error"
	lastRunID := 55
	if err := schedulesRepo.SetLastRunAtByPortfolioProfileID(profile.ID, &lastRunAt); err != nil {
		t.Fatalf("seed last_run_at: %v", err)
	}
	if err := schedulesRepo.SetLastErrorByPortfolioProfileID(profile.ID, &lastError); err != nil {
		t.Fatalf("seed last_error: %v", err)
	}
	if err := schedulesRepo.SetLastRunIDByPortfolioProfileID(profile.ID, &lastRunID); err != nil {
		t.Fatalf("seed last_run_id: %v", err)
	}

	resp, err := service.Upsert(context.Background(), userID, profile.ID, &dto.PortfolioRebalanceScheduleConfigUpsertRequest{
		IsEnabled: true,
		DtStart:   time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:     "FREQ=DAILY;COUNT=1",
	})
	if err != nil {
		t.Fatalf("upsert schedule enabled: %v", err)
	}
	if resp.NextRunAt == nil {
		t.Fatalf("expected next_run_at to be set on enabled schedule")
	}
	if got := resp.NextRunAt.Format(time.RFC3339); got != "2026-04-13T10:00:00Z" {
		t.Fatalf("unexpected next_run_at: %s", got)
	}
	if resp.LastRunAt == nil || !resp.LastRunAt.Equal(lastRunAt) {
		t.Fatalf("expected last_run_at to stay unchanged, got %v", resp.LastRunAt)
	}
	if resp.LastError == nil || *resp.LastError != lastError {
		t.Fatalf("expected last_error to stay unchanged, got %v", resp.LastError)
	}
	if resp.LastRunID == nil || *resp.LastRunID != lastRunID {
		t.Fatalf("expected last_run_id to stay unchanged, got %v", resp.LastRunID)
	}
}

func TestScheduleConfigService_UpsertDisabledClearsNextRunAtAndKeepsLastRuntimeFields(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	userID := 6
	profile := createScheduleConfigTestProfile(t, db, userID, "disabled runtime state")

	profilesRepo := repository.NewPortfolioProfilesRepository(db)
	schedulesRepo := repository.NewPortfolioRebalanceSchedulesRepository(db)
	runtimeState := NewScheduleRuntimeStateService(schedulesRepo, nil, isdayoff.NewService("https://isdayoff.ru"), "UTC")
	service := NewScheduleConfigService(profilesRepo, schedulesRepo, runtimeState)

	_, err := schedulesRepo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profile.ID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}

	nextRunAt := time.Date(2026, 4, 14, 10, 0, 0, 0, time.UTC)
	lastRunAt := time.Date(2026, 4, 12, 10, 0, 0, 0, time.UTC)
	lastError := "seeded error"
	lastRunID := 77
	if err := schedulesRepo.SetNextRunAtByPortfolioProfileID(profile.ID, &nextRunAt); err != nil {
		t.Fatalf("seed next_run_at: %v", err)
	}
	if err := schedulesRepo.SetLastRunAtByPortfolioProfileID(profile.ID, &lastRunAt); err != nil {
		t.Fatalf("seed last_run_at: %v", err)
	}
	if err := schedulesRepo.SetLastErrorByPortfolioProfileID(profile.ID, &lastError); err != nil {
		t.Fatalf("seed last_error: %v", err)
	}
	if err := schedulesRepo.SetLastRunIDByPortfolioProfileID(profile.ID, &lastRunID); err != nil {
		t.Fatalf("seed last_run_id: %v", err)
	}

	resp, err := service.Upsert(context.Background(), userID, profile.ID, &dto.PortfolioRebalanceScheduleConfigUpsertRequest{
		IsEnabled: false,
		DtStart:   time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:     "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("upsert schedule disabled: %v", err)
	}
	if resp.NextRunAt != nil {
		t.Fatalf("expected next_run_at to be nil on disabled schedule, got %v", resp.NextRunAt)
	}
	if resp.LastRunAt == nil || !resp.LastRunAt.Equal(lastRunAt) {
		t.Fatalf("expected last_run_at to stay unchanged, got %v", resp.LastRunAt)
	}
	if resp.LastError == nil || *resp.LastError != lastError {
		t.Fatalf("expected last_error to stay unchanged, got %v", resp.LastError)
	}
	if resp.LastRunID == nil || *resp.LastRunID != lastRunID {
		t.Fatalf("expected last_run_id to stay unchanged, got %v", resp.LastRunID)
	}
}

func createScheduleConfigTestProfile(t *testing.T, db *gorm.DB, userID int, name string) *models.PortfolioProfile {
	t.Helper()

	row := &models.PortfolioProfile{
		UserID:     userID,
		Provider:   "mock",
		Name:       name,
		IsDefault:  true,
		ConfigJSON: "{}",
		SecretJSON: "{}",
	}
	if err := db.Create(row).Error; err != nil {
		t.Fatalf("create profile: %v", err)
	}
	return row
}
