package activities

import (
	"context"
	"testing"
	"time"

	"server/internal/rebalance"
	"server/internal/workflows"
)

type fakeScheduleDispatcher struct {
	dispatch *rebalance.ScheduleDispatchResult
	err      error
	calls    int
}

func (f *fakeScheduleDispatcher) DispatchDueSchedules(_ context.Context, _ time.Time, _ time.Time) (*rebalance.ScheduleDispatchResult, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	return f.dispatch, nil
}

func TestRebalanceScheduleDispatchActivities_SelectDueCandidates_DisabledNoOp(t *testing.T) {
	dispatcher := &fakeScheduleDispatcher{}
	acts := NewRebalanceScheduleDispatchActivities(dispatcher, false)

	windowStart := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
	windowEnd := time.Date(2026, 4, 13, 10, 1, 0, 0, time.UTC)
	result, err := acts.SelectDueCandidates(context.Background(), workflows.RebalanceScheduleDispatchActivityParams{
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
	})
	if err != nil {
		t.Fatalf("SelectDueCandidates returned error: %v", err)
	}
	if result.Enabled {
		t.Fatalf("expected enabled=false")
	}
	if len(result.DueCandidates) != 0 {
		t.Fatalf("expected no candidates, got %d", len(result.DueCandidates))
	}
	if dispatcher.calls != 0 {
		t.Fatalf("expected dispatcher not called when disabled, got %d", dispatcher.calls)
	}
}

func TestRebalanceScheduleDispatchActivities_SelectDueCandidates_EnabledMapsDispatchResult(t *testing.T) {
	windowStart := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)
	windowEnd := time.Date(2026, 4, 13, 10, 1, 0, 0, time.UTC)
	dispatch := &rebalance.ScheduleDispatchResult{
		WindowStart:        windowStart,
		WindowEnd:          windowEnd,
		EvaluatedSchedules: 3,
		InvalidSchedules:   1,
		ClaimedSchedules:   1,
		SkippedSchedules:   1,
		CreatedRuns:        1,
		FailedRuns:         0,
		Candidates: []rebalance.ScheduleDispatchCandidate{
			{
				PortfolioProfileID: 10,
				ScheduleID:         55,
				DueAt:              time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
			},
		},
		Created: []rebalance.ScheduleDispatchCreatedRun{
			{
				PortfolioProfileID: 10,
				ScheduleID:         55,
				DueAt:              time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC),
				RunID:              501,
			},
		},
	}
	dispatcher := &fakeScheduleDispatcher{dispatch: dispatch}
	acts := NewRebalanceScheduleDispatchActivities(dispatcher, true)

	result, err := acts.SelectDueCandidates(context.Background(), workflows.RebalanceScheduleDispatchActivityParams{
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
	})
	if err != nil {
		t.Fatalf("SelectDueCandidates returned error: %v", err)
	}
	if !result.Enabled {
		t.Fatalf("expected enabled=true")
	}
	if result.EvaluatedSchedules != 3 {
		t.Fatalf("expected evaluatedSchedules=3, got %d", result.EvaluatedSchedules)
	}
	if result.InvalidSchedules != 1 {
		t.Fatalf("expected invalidSchedules=1, got %d", result.InvalidSchedules)
	}
	if result.ClaimedSchedules != 1 {
		t.Fatalf("expected claimedSchedules=1, got %d", result.ClaimedSchedules)
	}
	if result.SkippedSchedules != 1 {
		t.Fatalf("expected skippedSchedules=1, got %d", result.SkippedSchedules)
	}
	if result.CreatedRuns != 1 {
		t.Fatalf("expected createdRuns=1, got %d", result.CreatedRuns)
	}
	if len(result.DueCandidates) != 1 {
		t.Fatalf("expected 1 candidate, got %d", len(result.DueCandidates))
	}
	if len(result.Created) != 1 || result.Created[0].RunID != 501 {
		t.Fatalf("expected created run 501, got %+v", result.Created)
	}
	if dispatcher.calls != 1 {
		t.Fatalf("expected dispatcher called once, got %d", dispatcher.calls)
	}
}
