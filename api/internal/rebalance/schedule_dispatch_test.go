package rebalance

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"server/internal/api/dto"
	"server/internal/isdayoff"
	"server/internal/models"
	"server/internal/repository"
	"server/internal/testutil"

	"gorm.io/gorm"
)

type fakeSchedulePlanningEnqueuer struct {
	enqueueCalls int
	failedCalls  int
	fn           func(ctx context.Context, userID int, portfolioID int, req *dto.PortfolioRebalanceCreateRequest) (*models.PortfolioRebalanceRun, error)
	failedFn     func(ctx context.Context, userID int, portfolioID int, req *dto.PortfolioRebalanceCreateRequest, reason string) (*models.PortfolioRebalanceRun, error)
}

func (f *fakeSchedulePlanningEnqueuer) EnqueueDraftPlanning(
	ctx context.Context,
	userID int,
	portfolioID int,
	req *dto.PortfolioRebalanceCreateRequest,
) (*models.PortfolioRebalanceRun, error) {
	f.enqueueCalls++
	if f.fn != nil {
		return f.fn(ctx, userID, portfolioID, req)
	}
	return &models.PortfolioRebalanceRun{ID: 1}, nil
}

func (f *fakeSchedulePlanningEnqueuer) CreateFailedPlanningRun(
	ctx context.Context,
	userID int,
	portfolioID int,
	req *dto.PortfolioRebalanceCreateRequest,
	reason string,
) (*models.PortfolioRebalanceRun, error) {
	f.failedCalls++
	if f.failedFn != nil {
		return f.failedFn(ctx, userID, portfolioID, req, reason)
	}
	return &models.PortfolioRebalanceRun{ID: 2, Status: models.PortfolioRebalanceRunStatusPlanningFailed}, nil
}

func TestScheduleDispatchService_SelectDueCandidates(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	dayoffServer := newIsDayOffMockServer(t, map[string]string{"2026-04-13": "0"})
	defer dayoffServer.Close()

	profile1 := createDispatchTestProfile(t, db, 11, "candidate")
	profile2 := createDispatchTestProfile(t, db, 12, "future")
	profile3 := createDispatchTestProfile(t, db, 13, "overdue")
	repo := repository.NewPortfolioRebalanceSchedulesRepository(db)

	schedule1, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profile1.ID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed schedule 1: %v", err)
	}
	schedule2, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profile2.ID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 5, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed schedule 2: %v", err)
	}
	_, err = repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profile3.ID,
		IsEnabled:          true,
		DtStart:            time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
		RRule:              "FREQ=DAILY",
	})
	if err != nil {
		t.Fatalf("seed schedule 3: %v", err)
	}
	dueAt := time.Date(2026, 4, 13, 10, 30, 0, 0, time.UTC)
	overdueAt := time.Date(2026, 4, 13, 9, 0, 0, 0, time.UTC)
	futureAt := time.Date(2026, 4, 13, 11, 5, 0, 0, time.UTC)
	if err := repo.SetNextRunAtByPortfolioProfileID(profile1.ID, &dueAt); err != nil {
		t.Fatalf("set schedule1 next_run_at: %v", err)
	}
	if err := repo.SetNextRunAtByPortfolioProfileID(profile2.ID, &futureAt); err != nil {
		t.Fatalf("set schedule2 next_run_at: %v", err)
	}
	if err := repo.SetNextRunAtByPortfolioProfileID(profile3.ID, &overdueAt); err != nil {
		t.Fatalf("set schedule3 next_run_at: %v", err)
	}

	service := NewScheduleDispatchService(repo, nil, isdayoff.NewService(dayoffServer.URL), "UTC")

	windowStart := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
	windowEnd := time.Date(2026, 4, 13, 11, 0, 0, 0, time.UTC)
	selection, err := service.SelectDueCandidates(context.Background(), windowStart, windowEnd)
	if err != nil {
		t.Fatalf("SelectDueCandidates returned error: %v", err)
	}
	if selection.EvaluatedSchedules != 3 {
		t.Fatalf("expected 3 evaluated schedules, got %d", selection.EvaluatedSchedules)
	}
	if selection.InvalidSchedules != 0 {
		t.Fatalf("expected 0 invalid schedules, got %d", selection.InvalidSchedules)
	}
	if len(selection.Candidates) != 1 {
		t.Fatalf("expected 1 due candidate, got %d", len(selection.Candidates))
	}
	if len(selection.OverdueCandidates) != 1 {
		t.Fatalf("expected 1 overdue candidate, got %d", len(selection.OverdueCandidates))
	}
	candidate := selection.Candidates[0]
	if candidate.PortfolioProfileID != profile1.ID {
		t.Fatalf("expected profile %d, got %d", profile1.ID, candidate.PortfolioProfileID)
	}
	if candidate.ScheduleID != schedule1.ID {
		t.Fatalf("expected schedule %d, got %d", schedule1.ID, candidate.ScheduleID)
	}
	if got := candidate.DueAt.Format(time.RFC3339); got != "2026-04-13T10:30:00Z" {
		t.Fatalf("unexpected due_at: %s", got)
	}
	if schedule2.ID == candidate.ScheduleID {
		t.Fatalf("future schedule should not be selected")
	}
	overdue := selection.OverdueCandidates[0]
	if overdue.PortfolioProfileID != profile3.ID {
		t.Fatalf("expected overdue profile %d, got %d", profile3.ID, overdue.PortfolioProfileID)
	}
}

func TestScheduleDispatchService_DispatchCreatesExactlyOneRunAndIdempotent(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	dueAt := time.Date(2026, 4, 13, 10, 59, 30, 0, time.UTC)
	nextDueAt := time.Date(2026, 4, 14, 10, 59, 30, 0, time.UTC)
	dayoffServer := newIsDayOffMockServer(t, map[string]string{
		"2026-04-13": "0",
		"2026-04-14": "0",
	})
	defer dayoffServer.Close()

	profile := createDispatchTestProfile(t, db, 50, "dispatch success")
	repo := repository.NewPortfolioRebalanceSchedulesRepository(db)
	schedule, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profile.ID,
		IsEnabled:          true,
		DtStart:            dueAt,
		RRule:              "FREQ=DAILY;COUNT=2",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}
	if err := repo.SetNextRunAtByPortfolioProfileID(profile.ID, &dueAt); err != nil {
		t.Fatalf("seed next_run_at: %v", err)
	}

	planner := &fakeSchedulePlanningEnqueuer{}
	planner.fn = func(_ context.Context, userID int, portfolioID int, req *dto.PortfolioRebalanceCreateRequest) (*models.PortfolioRebalanceRun, error) {
		if userID != profile.UserID {
			return nil, fmt.Errorf("unexpected userID: %d", userID)
		}
		if portfolioID != profile.ID {
			return nil, fmt.Errorf("unexpected portfolioID: %d", portfolioID)
		}
		if req == nil || req.AsOfDate != dueAt.Format("2006-01-02") {
			return nil, fmt.Errorf("unexpected as_of_date: %+v", req)
		}
		current, getErr := repo.GetByPortfolioProfileID(profile.ID)
		if getErr != nil {
			return nil, getErr
		}
		if current.NextRunAt == nil || !current.NextRunAt.Equal(nextDueAt) {
			return nil, fmt.Errorf("expected next_run_at advanced before enqueue, got %v", current.NextRunAt)
		}
		return &models.PortfolioRebalanceRun{ID: 501}, nil
	}

	service := NewScheduleDispatchService(repo, planner, isdayoff.NewService(dayoffServer.URL), "UTC")
	windowStart := time.Date(2026, 4, 13, 10, 59, 0, 0, time.UTC)
	windowEnd := time.Date(2026, 4, 13, 11, 0, 0, 0, time.UTC)

	first, err := service.DispatchDueSchedules(context.Background(), windowStart, windowEnd)
	if err != nil {
		t.Fatalf("DispatchDueSchedules returned error: %v", err)
	}
	if first.ClaimedSchedules != 1 {
		t.Fatalf("expected claimedSchedules=1, got %d", first.ClaimedSchedules)
	}
	if first.CreatedRuns != 1 {
		t.Fatalf("expected createdRuns=1, got %d", first.CreatedRuns)
	}
	if first.FailedRuns != 0 {
		t.Fatalf("expected failedRuns=0, got %d", first.FailedRuns)
	}
	if planner.enqueueCalls != 1 {
		t.Fatalf("expected planner enqueue called once, got %d", planner.enqueueCalls)
	}
	if planner.failedCalls != 0 {
		t.Fatalf("expected failed run path not called, got %d", planner.failedCalls)
	}

	updated, err := repo.GetByID(schedule.ID)
	if err != nil {
		t.Fatalf("get updated schedule: %v", err)
	}
	if updated.NextRunAt == nil || !updated.NextRunAt.Equal(nextDueAt) {
		t.Fatalf("expected next_run_at=%s, got %v", nextDueAt.Format(time.RFC3339), updated.NextRunAt)
	}
	if updated.LastRunAt == nil || !updated.LastRunAt.Equal(dueAt) {
		t.Fatalf("expected last_run_at=%s, got %v", dueAt.Format(time.RFC3339), updated.LastRunAt)
	}
	if updated.LastRunID == nil || *updated.LastRunID != 501 {
		t.Fatalf("expected last_run_id=501, got %v", updated.LastRunID)
	}
	if updated.LastError != nil {
		t.Fatalf("expected last_error cleared, got %v", updated.LastError)
	}

	second, err := service.DispatchDueSchedules(context.Background(), windowStart, windowEnd)
	if err != nil {
		t.Fatalf("second DispatchDueSchedules returned error: %v", err)
	}
	if second.CreatedRuns != 0 {
		t.Fatalf("expected second createdRuns=0, got %d", second.CreatedRuns)
	}
	if planner.enqueueCalls != 1 {
		t.Fatalf("expected planner still called once after retry/tick overlap, got %d", planner.enqueueCalls)
	}
	if planner.failedCalls != 0 {
		t.Fatalf("expected failed run path still not called, got %d", planner.failedCalls)
	}
}

func TestScheduleDispatchService_DispatchFailureSetsLastErrorAndKeepsLastRunFields(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	dueAt := time.Date(2026, 4, 13, 10, 59, 30, 0, time.UTC)
	nextDueAt := time.Date(2026, 4, 14, 10, 59, 30, 0, time.UTC)
	dayoffServer := newIsDayOffMockServer(t, map[string]string{
		"2026-04-13": "0",
		"2026-04-14": "0",
	})
	defer dayoffServer.Close()

	profile := createDispatchTestProfile(t, db, 51, "dispatch failure")
	repo := repository.NewPortfolioRebalanceSchedulesRepository(db)
	schedule, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profile.ID,
		IsEnabled:          true,
		DtStart:            dueAt,
		RRule:              "FREQ=DAILY;COUNT=2",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}
	if err := repo.SetNextRunAtByPortfolioProfileID(profile.ID, &dueAt); err != nil {
		t.Fatalf("seed next_run_at: %v", err)
	}
	seedLastRunAt := time.Date(2026, 4, 12, 10, 0, 0, 0, time.UTC)
	seedLastRunID := 700
	if err := repo.SetLastRunAtByPortfolioProfileID(profile.ID, &seedLastRunAt); err != nil {
		t.Fatalf("seed last_run_at: %v", err)
	}
	if err := repo.SetLastRunIDByPortfolioProfileID(profile.ID, &seedLastRunID); err != nil {
		t.Fatalf("seed last_run_id: %v", err)
	}

	planner := &fakeSchedulePlanningEnqueuer{}
	planner.fn = func(_ context.Context, _ int, _ int, _ *dto.PortfolioRebalanceCreateRequest) (*models.PortfolioRebalanceRun, error) {
		return nil, errors.New("enqueue failed")
	}

	service := NewScheduleDispatchService(repo, planner, isdayoff.NewService(dayoffServer.URL), "UTC")
	windowStart := time.Date(2026, 4, 13, 10, 59, 0, 0, time.UTC)
	windowEnd := time.Date(2026, 4, 13, 11, 0, 0, 0, time.UTC)

	first, err := service.DispatchDueSchedules(context.Background(), windowStart, windowEnd)
	if err != nil {
		t.Fatalf("DispatchDueSchedules returned error: %v", err)
	}
	if first.ClaimedSchedules != 1 {
		t.Fatalf("expected claimedSchedules=1, got %d", first.ClaimedSchedules)
	}
	if first.CreatedRuns != 0 {
		t.Fatalf("expected createdRuns=0, got %d", first.CreatedRuns)
	}
	if first.FailedRuns != 1 {
		t.Fatalf("expected failedRuns=1, got %d", first.FailedRuns)
	}
	if planner.enqueueCalls != 1 {
		t.Fatalf("expected planner enqueue called once, got %d", planner.enqueueCalls)
	}
	if planner.failedCalls != 0 {
		t.Fatalf("expected failed run path not called, got %d", planner.failedCalls)
	}

	updated, err := repo.GetByID(schedule.ID)
	if err != nil {
		t.Fatalf("get updated schedule: %v", err)
	}
	if updated.NextRunAt == nil || !updated.NextRunAt.Equal(nextDueAt) {
		t.Fatalf("expected next_run_at advanced to %s, got %v", nextDueAt.Format(time.RFC3339), updated.NextRunAt)
	}
	if updated.LastRunAt == nil || !updated.LastRunAt.Equal(seedLastRunAt) {
		t.Fatalf("expected last_run_at unchanged, got %v", updated.LastRunAt)
	}
	if updated.LastRunID == nil || *updated.LastRunID != seedLastRunID {
		t.Fatalf("expected last_run_id unchanged, got %v", updated.LastRunID)
	}
	if updated.LastError == nil || *updated.LastError != "enqueue failed" {
		t.Fatalf("expected last_error updated, got %v", updated.LastError)
	}

	_, err = service.DispatchDueSchedules(context.Background(), windowStart, windowEnd)
	if err != nil {
		t.Fatalf("second DispatchDueSchedules returned error: %v", err)
	}
	if planner.enqueueCalls != 1 {
		t.Fatalf("expected planner still called once after duplicate retry/tick, got %d", planner.enqueueCalls)
	}
	if planner.failedCalls != 0 {
		t.Fatalf("expected failed run path still not called, got %d", planner.failedCalls)
	}
}

func TestScheduleDispatchService_OverdueDueAtCreatesFailedRunWithoutPlanning(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	dueAt := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
	nextDueAt := time.Date(2026, 4, 14, 10, 0, 0, 0, time.UTC)
	dayoffServer := newIsDayOffMockServer(t, map[string]string{
		"2026-04-13": "0",
		"2026-04-14": "0",
	})
	defer dayoffServer.Close()

	profile := createDispatchTestProfile(t, db, 52, "dispatch overdue")
	repo := repository.NewPortfolioRebalanceSchedulesRepository(db)
	schedule, err := repo.Upsert(&models.PortfolioRebalanceSchedule{
		PortfolioProfileID: profile.ID,
		IsEnabled:          true,
		DtStart:            dueAt,
		RRule:              "FREQ=DAILY;COUNT=2",
	})
	if err != nil {
		t.Fatalf("seed schedule: %v", err)
	}
	if err := repo.SetNextRunAtByPortfolioProfileID(profile.ID, &dueAt); err != nil {
		t.Fatalf("seed next_run_at: %v", err)
	}

	planner := &fakeSchedulePlanningEnqueuer{}
	planner.failedFn = func(_ context.Context, userID int, portfolioID int, req *dto.PortfolioRebalanceCreateRequest, reason string) (*models.PortfolioRebalanceRun, error) {
		if userID != profile.UserID {
			return nil, fmt.Errorf("unexpected userID: %d", userID)
		}
		if portfolioID != profile.ID {
			return nil, fmt.Errorf("unexpected portfolioID: %d", portfolioID)
		}
		if req == nil || req.AsOfDate != dueAt.Format("2006-01-02") {
			return nil, fmt.Errorf("unexpected as_of_date: %+v", req)
		}
		if reason == "" {
			return nil, fmt.Errorf("expected stale reason")
		}
		return &models.PortfolioRebalanceRun{ID: 902, Status: models.PortfolioRebalanceRunStatusPlanningFailed}, nil
	}

	service := NewScheduleDispatchService(repo, planner, isdayoff.NewService(dayoffServer.URL), "UTC")
	windowStart := time.Date(2026, 4, 13, 10, 30, 0, 0, time.UTC)
	windowEnd := time.Date(2026, 4, 13, 11, 0, 0, 0, time.UTC)

	first, err := service.DispatchDueSchedules(context.Background(), windowStart, windowEnd)
	if err != nil {
		t.Fatalf("DispatchDueSchedules returned error: %v", err)
	}
	if first.ClaimedSchedules != 1 {
		t.Fatalf("expected claimedSchedules=1, got %d", first.ClaimedSchedules)
	}
	if first.CreatedRuns != 1 {
		t.Fatalf("expected createdRuns=1 for stale failed run, got %d", first.CreatedRuns)
	}
	if first.FailedRuns != 1 {
		t.Fatalf("expected failedRuns=1 for stale failed run, got %d", first.FailedRuns)
	}
	if planner.enqueueCalls != 0 {
		t.Fatalf("expected no planning enqueue call for stale due_at, got %d", planner.enqueueCalls)
	}
	if planner.failedCalls != 1 {
		t.Fatalf("expected failed-run creation call once, got %d", planner.failedCalls)
	}

	updated, err := repo.GetByID(schedule.ID)
	if err != nil {
		t.Fatalf("get updated schedule: %v", err)
	}
	if updated.NextRunAt == nil || !updated.NextRunAt.Equal(nextDueAt) {
		t.Fatalf("expected next_run_at advanced to %s, got %v", nextDueAt.Format(time.RFC3339), updated.NextRunAt)
	}
	if updated.LastRunAt != nil {
		t.Fatalf("expected last_run_at unchanged(nil), got %v", updated.LastRunAt)
	}
	if updated.LastRunID != nil {
		t.Fatalf("expected last_run_id unchanged(nil), got %v", updated.LastRunID)
	}
	if updated.LastError == nil {
		t.Fatalf("expected last_error set for stale due_at")
	}

	second, err := service.DispatchDueSchedules(context.Background(), windowStart, windowEnd)
	if err != nil {
		t.Fatalf("second DispatchDueSchedules returned error: %v", err)
	}
	if second.CreatedRuns != 0 {
		t.Fatalf("expected second createdRuns=0, got %d", second.CreatedRuns)
	}
	if planner.enqueueCalls != 0 {
		t.Fatalf("expected still no planning enqueue call, got %d", planner.enqueueCalls)
	}
	if planner.failedCalls != 1 {
		t.Fatalf("expected failed-run creation still called once after duplicate retry/tick, got %d", planner.failedCalls)
	}
}

func createDispatchTestProfile(t *testing.T, db *gorm.DB, userID int, name string) *models.PortfolioProfile {
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
