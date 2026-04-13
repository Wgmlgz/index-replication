package activities

import (
	"context"
	"fmt"
	"time"

	"server/internal/rebalance"
	"server/internal/workflows"
)

type rebalanceScheduleDispatcher interface {
	DispatchDueSchedules(ctx context.Context, windowStart time.Time, windowEnd time.Time) (*rebalance.ScheduleDispatchResult, error)
}

type RebalanceScheduleDispatchActivities struct {
	dispatcher rebalanceScheduleDispatcher
	enabled    bool
}

func NewRebalanceScheduleDispatchActivities(
	dispatcher rebalanceScheduleDispatcher,
	enabled bool,
) *RebalanceScheduleDispatchActivities {
	return &RebalanceScheduleDispatchActivities{
		dispatcher: dispatcher,
		enabled:    enabled,
	}
}

func (a *RebalanceScheduleDispatchActivities) SelectDueCandidates(
	ctx context.Context,
	params workflows.RebalanceScheduleDispatchActivityParams,
) (workflows.RebalanceScheduleDispatchResult, error) {
	result := workflows.RebalanceScheduleDispatchResult{
		Enabled:           a != nil && a.enabled,
		WindowStart:       params.WindowStart.UTC(),
		WindowEnd:         params.WindowEnd.UTC(),
		DueCandidates:     []workflows.RebalanceScheduleDispatchCandidate{},
		OverdueCandidates: []workflows.RebalanceScheduleDispatchCandidate{},
		Created:           []workflows.RebalanceScheduleDispatchCreatedRun{},
	}
	if a == nil || !a.enabled {
		return result, nil
	}
	if a.dispatcher == nil {
		return result, fmt.Errorf("rebalance schedule dispatch activity is not initialized")
	}

	dispatch, err := a.dispatcher.DispatchDueSchedules(ctx, params.WindowStart, params.WindowEnd)
	if err != nil {
		return result, err
	}
	if dispatch == nil {
		return result, nil
	}

	result.WindowStart = dispatch.WindowStart.UTC()
	result.WindowEnd = dispatch.WindowEnd.UTC()
	result.EvaluatedSchedules = dispatch.EvaluatedSchedules
	result.InvalidSchedules = dispatch.InvalidSchedules
	result.ClaimedSchedules = dispatch.ClaimedSchedules
	result.SkippedSchedules = dispatch.SkippedSchedules
	result.CreatedRuns = dispatch.CreatedRuns
	result.FailedRuns = dispatch.FailedRuns

	if len(dispatch.Candidates) > 0 {
		result.DueCandidates = make([]workflows.RebalanceScheduleDispatchCandidate, 0, len(dispatch.Candidates))
		for _, candidate := range dispatch.Candidates {
			result.DueCandidates = append(result.DueCandidates, workflows.RebalanceScheduleDispatchCandidate{
				PortfolioProfileID: candidate.PortfolioProfileID,
				ScheduleID:         candidate.ScheduleID,
				DueAt:              candidate.DueAt.UTC(),
			})
		}
	}

	if len(dispatch.OverdueCandidates) > 0 {
		result.OverdueCandidates = make([]workflows.RebalanceScheduleDispatchCandidate, 0, len(dispatch.OverdueCandidates))
		for _, candidate := range dispatch.OverdueCandidates {
			result.OverdueCandidates = append(result.OverdueCandidates, workflows.RebalanceScheduleDispatchCandidate{
				PortfolioProfileID: candidate.PortfolioProfileID,
				ScheduleID:         candidate.ScheduleID,
				DueAt:              candidate.DueAt.UTC(),
			})
		}
	}

	if len(dispatch.Created) > 0 {
		result.Created = make([]workflows.RebalanceScheduleDispatchCreatedRun, 0, len(dispatch.Created))
		for _, created := range dispatch.Created {
			result.Created = append(result.Created, workflows.RebalanceScheduleDispatchCreatedRun{
				PortfolioProfileID: created.PortfolioProfileID,
				ScheduleID:         created.ScheduleID,
				DueAt:              created.DueAt.UTC(),
				RunID:              created.RunID,
			})
		}
	}

	return result, nil
}
