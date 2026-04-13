package rebalance

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"server/internal/api/dto"
	"server/internal/isdayoff"
	"server/internal/models"

	"gorm.io/gorm"
)

const (
	defaultScheduleDispatchWindow     = time.Minute
	scheduleDispatchNextRunHorizonYrs = 5
)

type scheduleDispatchRepository interface {
	ListEnabled() ([]models.PortfolioRebalanceSchedule, error)
	GetByID(scheduleID int) (*models.PortfolioRebalanceSchedule, error)
	GetPortfolioProfileOwnerID(ctx context.Context, profileID int) (int, error)
	ClaimDueAndAdvanceNextRun(ctx context.Context, scheduleID int, profileID int, dueAt time.Time, nextRunAt *time.Time) (bool, error)
	MarkDispatchPlanningSuccess(ctx context.Context, scheduleID int, dueAt time.Time, runID int) error
	MarkDispatchPlanningFailure(ctx context.Context, scheduleID int, lastError string) error
}

type schedulePlanningEnqueuer interface {
	EnqueueDraftPlanning(
		ctx context.Context,
		userID int,
		portfolioID int,
		req *dto.PortfolioRebalanceCreateRequest,
	) (*models.PortfolioRebalanceRun, error)
}

type ScheduleDispatchCandidate struct {
	PortfolioProfileID int       `json:"portfolioProfileId"`
	ScheduleID         int       `json:"scheduleId"`
	DueAt              time.Time `json:"dueAt"`
}

type ScheduleDispatchCreatedRun struct {
	PortfolioProfileID int       `json:"portfolioProfileId"`
	ScheduleID         int       `json:"scheduleId"`
	DueAt              time.Time `json:"dueAt"`
	RunID              int       `json:"runId"`
}

type ScheduleDispatchSelection struct {
	WindowStart        time.Time
	WindowEnd          time.Time
	EvaluatedSchedules int
	InvalidSchedules   int
	Candidates         []ScheduleDispatchCandidate
}

type ScheduleDispatchResult struct {
	WindowStart        time.Time
	WindowEnd          time.Time
	EvaluatedSchedules int
	InvalidSchedules   int
	Candidates         []ScheduleDispatchCandidate
	ClaimedSchedules   int
	SkippedSchedules   int
	CreatedRuns        int
	FailedRuns         int
	Created            []ScheduleDispatchCreatedRun
}

type ScheduleDispatchService struct {
	schedulesRepo scheduleDispatchRepository
	planner       schedulePlanningEnqueuer
	engine        *scheduleEventEngine
}

func NewScheduleDispatchService(
	schedulesRepo scheduleDispatchRepository,
	planner schedulePlanningEnqueuer,
	dayOffService *isdayoff.Service,
	scheduleTimezone ...string,
) *ScheduleDispatchService {
	location := loadScheduleLocation(scheduleTimezone...)

	var engine *scheduleEventEngine
	if dayOffService != nil {
		engine = newScheduleEventEngine(dayOffService, location)
	}

	return &ScheduleDispatchService{
		schedulesRepo: schedulesRepo,
		planner:       planner,
		engine:        engine,
	}
}

func (s *ScheduleDispatchService) DispatchDueSchedules(
	ctx context.Context,
	windowStart time.Time,
	windowEnd time.Time,
) (*ScheduleDispatchResult, error) {
	if s == nil || s.schedulesRepo == nil || s.engine == nil {
		return nil, ErrScheduleConfigUnavailable
	}
	if s.planner == nil {
		return nil, ErrPlanningUnavailable
	}

	selection, err := s.SelectDueCandidates(ctx, windowStart, windowEnd)
	if err != nil {
		return nil, err
	}

	result := &ScheduleDispatchResult{
		WindowStart:        selection.WindowStart,
		WindowEnd:          selection.WindowEnd,
		EvaluatedSchedules: selection.EvaluatedSchedules,
		InvalidSchedules:   selection.InvalidSchedules,
		Candidates:         selection.Candidates,
		Created:            []ScheduleDispatchCreatedRun{},
	}
	for _, candidate := range selection.Candidates {
		schedule, getErr := s.schedulesRepo.GetByID(candidate.ScheduleID)
		if getErr != nil {
			if errors.Is(getErr, gorm.ErrRecordNotFound) {
				result.SkippedSchedules++
				continue
			}
			return nil, getErr
		}

		nextRunAt, nextErr := s.nextRunAtAfterDue(ctx, schedule, candidate.DueAt)
		if nextErr != nil {
			result.FailedRuns++
			_ = s.schedulesRepo.MarkDispatchPlanningFailure(ctx, candidate.ScheduleID, nextErr.Error())
			continue
		}

		claimed, claimErr := s.schedulesRepo.ClaimDueAndAdvanceNextRun(
			ctx,
			candidate.ScheduleID,
			candidate.PortfolioProfileID,
			candidate.DueAt,
			nextRunAt,
		)
		if claimErr != nil {
			return nil, claimErr
		}
		if !claimed {
			result.SkippedSchedules++
			continue
		}
		result.ClaimedSchedules++

		ownerID, ownerErr := s.schedulesRepo.GetPortfolioProfileOwnerID(ctx, candidate.PortfolioProfileID)
		if ownerErr != nil {
			result.FailedRuns++
			_ = s.schedulesRepo.MarkDispatchPlanningFailure(
				ctx,
				candidate.ScheduleID,
				fmt.Sprintf("resolve profile owner: %v", ownerErr),
			)
			continue
		}

		run, enqueueErr := s.planner.EnqueueDraftPlanning(
			ctx,
			ownerID,
			candidate.PortfolioProfileID,
			&dto.PortfolioRebalanceCreateRequest{
				AsOfDate: candidate.DueAt.UTC().Format("2006-01-02"),
			},
		)
		if enqueueErr != nil {
			result.FailedRuns++
			_ = s.schedulesRepo.MarkDispatchPlanningFailure(ctx, candidate.ScheduleID, enqueueErr.Error())
			continue
		}
		if run == nil || run.ID <= 0 {
			result.FailedRuns++
			_ = s.schedulesRepo.MarkDispatchPlanningFailure(ctx, candidate.ScheduleID, "planning enqueue returned empty run")
			continue
		}

		if markErr := s.schedulesRepo.MarkDispatchPlanningSuccess(ctx, candidate.ScheduleID, candidate.DueAt, run.ID); markErr != nil {
			return nil, markErr
		}

		result.CreatedRuns++
		result.Created = append(result.Created, ScheduleDispatchCreatedRun{
			PortfolioProfileID: candidate.PortfolioProfileID,
			ScheduleID:         candidate.ScheduleID,
			DueAt:              candidate.DueAt.UTC(),
			RunID:              run.ID,
		})
	}

	return result, nil
}

func (s *ScheduleDispatchService) SelectDueCandidates(
	ctx context.Context,
	windowStart time.Time,
	windowEnd time.Time,
) (*ScheduleDispatchSelection, error) {
	if s == nil || s.schedulesRepo == nil || s.engine == nil {
		return nil, ErrScheduleConfigUnavailable
	}

	if windowStart.IsZero() || windowEnd.IsZero() {
		windowEnd = time.Now().UTC()
		windowStart = windowEnd.Add(-defaultScheduleDispatchWindow)
	}
	windowStart = windowStart.UTC()
	windowEnd = windowEnd.UTC()
	if windowEnd.Before(windowStart) {
		windowStart, windowEnd = windowEnd, windowStart
	}

	rows, err := s.schedulesRepo.ListEnabled()
	if err != nil {
		return nil, err
	}

	selection := &ScheduleDispatchSelection{
		WindowStart:        windowStart,
		WindowEnd:          windowEnd,
		EvaluatedSchedules: len(rows),
		Candidates:         make([]ScheduleDispatchCandidate, 0),
	}
	for i := range rows {
		schedule := rows[i]
		result, ok, calcErr := s.calculateScheduleCandidates(ctx, schedule, windowStart, windowEnd)
		if calcErr != nil {
			return nil, calcErr
		}
		if !ok {
			selection.InvalidSchedules++
			continue
		}
		selection.Candidates = append(selection.Candidates, result...)
	}

	sort.Slice(selection.Candidates, func(i, j int) bool {
		left := selection.Candidates[i]
		right := selection.Candidates[j]
		if left.DueAt.Equal(right.DueAt) {
			if left.PortfolioProfileID == right.PortfolioProfileID {
				return left.ScheduleID < right.ScheduleID
			}
			return left.PortfolioProfileID < right.PortfolioProfileID
		}
		return left.DueAt.Before(right.DueAt)
	})

	return selection, nil
}

func (s *ScheduleDispatchService) calculateScheduleCandidates(
	ctx context.Context,
	schedule models.PortfolioRebalanceSchedule,
	windowStart time.Time,
	windowEnd time.Time,
) ([]ScheduleDispatchCandidate, bool, error) {
	from := windowStart.Add(time.Nanosecond)
	to := windowEnd
	limit := maximumSchedulePreviewLimit
	req := &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart:               schedule.DtStart,
		RRule:                 schedule.RRule,
		BusinessDayAdjustment: schedule.BusinessDayAdjustment,
		From:                  &from,
		To:                    &to,
		Limit:                 &limit,
	}

	plan, err := prepareSchedulePreviewPlan(req, time.Now, s.engine.location)
	if err != nil {
		return nil, false, nil
	}
	preview, err := s.engine.Calculate(ctx, *plan)
	if err != nil {
		return nil, false, err
	}

	candidates := make([]ScheduleDispatchCandidate, 0, len(preview.Events))
	for _, event := range preview.Events {
		candidates = append(candidates, ScheduleDispatchCandidate{
			PortfolioProfileID: schedule.PortfolioProfileID,
			ScheduleID:         schedule.ID,
			DueAt:              event.UTC(),
		})
	}
	return candidates, true, nil
}

func (s *ScheduleDispatchService) nextRunAtAfterDue(
	ctx context.Context,
	schedule *models.PortfolioRebalanceSchedule,
	dueAt time.Time,
) (*time.Time, error) {
	if schedule == nil {
		return nil, gorm.ErrInvalidData
	}
	from := dueAt.UTC().Add(time.Nanosecond)
	to := from.AddDate(scheduleDispatchNextRunHorizonYrs, 0, 0)
	limit := 1
	req := &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart:               schedule.DtStart,
		RRule:                 schedule.RRule,
		BusinessDayAdjustment: schedule.BusinessDayAdjustment,
		From:                  &from,
		To:                    &to,
		Limit:                 &limit,
	}

	plan, err := prepareSchedulePreviewPlan(req, func() time.Time { return dueAt.UTC() }, s.engine.location)
	if err != nil {
		return nil, err
	}
	preview, err := s.engine.Calculate(ctx, *plan)
	if err != nil {
		return nil, err
	}
	if len(preview.Events) == 0 {
		return nil, nil
	}
	value := preview.Events[0].UTC()
	return &value, nil
}
