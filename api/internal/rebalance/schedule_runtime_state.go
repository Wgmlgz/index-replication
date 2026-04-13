package rebalance

import (
	"context"
	"errors"
	"fmt"
	"time"

	"server/internal/api/dto"
	"server/internal/isdayoff"
	"server/internal/models"

	"gorm.io/gorm"
)

const nextRunSearchHorizonYears = 5

type scheduleRuntimeSchedulesRepository interface {
	GetByPortfolioProfileID(profileID int) (*models.PortfolioRebalanceSchedule, error)
	SetNextRunAtByPortfolioProfileID(profileID int, nextRunAt *time.Time) error
}

type scheduleRuntimeReplicationRepository interface {
	GetByPortfolioProfileID(profileID int) (*models.PortfolioReplicationConfig, error)
}

type ScheduleRuntimeStateService struct {
	schedulesRepo   scheduleRuntimeSchedulesRepository
	replicationRepo scheduleRuntimeReplicationRepository
	engine          *scheduleEventEngine
	now             func() time.Time
}

func NewScheduleRuntimeStateService(
	schedulesRepo scheduleRuntimeSchedulesRepository,
	replicationRepo scheduleRuntimeReplicationRepository,
	dayOffService *isdayoff.Service,
	scheduleTimezone ...string,
) *ScheduleRuntimeStateService {
	location := loadScheduleLocation(scheduleTimezone...)

	var engine *scheduleEventEngine
	if dayOffService != nil {
		engine = newScheduleEventEngine(dayOffService, location)
	}

	return &ScheduleRuntimeStateService{
		schedulesRepo:   schedulesRepo,
		replicationRepo: replicationRepo,
		engine:          engine,
		now: func() time.Time {
			return time.Now().UTC()
		},
	}
}

// ApplyScheduleUpsertState updates only next_run_at for a concrete schedule row.
// It intentionally never writes last_run_at/last_error/last_run_id.
func (s *ScheduleRuntimeStateService) ApplyScheduleUpsertState(
	ctx context.Context,
	schedule *models.PortfolioRebalanceSchedule,
) error {
	if schedule == nil {
		return gorm.ErrInvalidData
	}
	if s.schedulesRepo == nil {
		return ErrScheduleConfigUnavailable
	}

	nextRunAt, err := s.nextRunAtForSchedule(ctx, schedule)
	if err != nil {
		return err
	}
	if schedule.IsEnabled && nextRunAt == nil {
		return fmt.Errorf("%w: enabled schedule has no future trading events", ErrInvalidRequest)
	}
	return s.schedulesRepo.SetNextRunAtByPortfolioProfileID(schedule.PortfolioProfileID, nextRunAt)
}

// SyncByPortfolioProfileID reconciles next_run_at when external config changes.
// It intentionally updates only next_run_at.
func (s *ScheduleRuntimeStateService) SyncByPortfolioProfileID(ctx context.Context, portfolioID int) error {
	if portfolioID <= 0 {
		return ErrInvalidProfileID
	}
	if s.schedulesRepo == nil {
		return ErrScheduleConfigUnavailable
	}

	schedule, err := s.schedulesRepo.GetByPortfolioProfileID(portfolioID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if !schedule.IsEnabled {
		return s.schedulesRepo.SetNextRunAtByPortfolioProfileID(portfolioID, nil)
	}

	if s.replicationRepo != nil {
		replication, replicationErr := s.replicationRepo.GetByPortfolioProfileID(portfolioID)
		if replicationErr != nil {
			if errors.Is(replicationErr, gorm.ErrRecordNotFound) {
				return nil
			}
			return replicationErr
		}
		if !replication.IsEnabled {
			return nil
		}
	}

	nextRunAt, err := s.nextRunAtForSchedule(ctx, schedule)
	if err != nil {
		return err
	}
	if nextRunAt == nil {
		return fmt.Errorf("%w: enabled schedule has no future trading events", ErrInvalidRequest)
	}
	return s.schedulesRepo.SetNextRunAtByPortfolioProfileID(portfolioID, nextRunAt)
}

func (s *ScheduleRuntimeStateService) nextRunAtForSchedule(
	ctx context.Context,
	schedule *models.PortfolioRebalanceSchedule,
) (*time.Time, error) {
	if schedule == nil {
		return nil, gorm.ErrInvalidData
	}
	if !schedule.IsEnabled {
		return nil, nil
	}
	if s.engine == nil {
		return nil, ErrScheduleConfigUnavailable
	}

	req := &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart:               schedule.DtStart,
		RRule:                 schedule.RRule,
		BusinessDayAdjustment: schedule.BusinessDayAdjustment,
	}
	plan, err := prepareSchedulePreviewPlan(req, s.now, s.engine.location)
	if err != nil {
		return nil, err
	}

	plan.limit = 1
	to := plan.from.AddDate(nextRunSearchHorizonYears, 0, 0)
	plan.to = &to

	result, err := s.engine.Calculate(ctx, *plan)
	if err != nil {
		return nil, err
	}
	if len(result.Events) == 0 && plan.policy == businessDayAdjustmentStrict {
		fallbackPlan := *plan
		fallbackPlan.policy = businessDayAdjustmentFollowing
		result, err = s.engine.Calculate(ctx, fallbackPlan)
		if err != nil {
			return nil, err
		}
	}
	if len(result.Events) == 0 {
		return nil, nil
	}

	nextRunAt := result.Events[0].UTC()
	return &nextRunAt, nil
}
