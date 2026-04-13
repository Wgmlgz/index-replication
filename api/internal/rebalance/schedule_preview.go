package rebalance

import (
	"context"
	"errors"
	"fmt"
	"time"

	"server/internal/api/dto"
	"server/internal/isdayoff"

	"gorm.io/gorm"
)

type SchedulePreviewService struct {
	profilesRepo  profileRepository
	dayOffService *isdayoff.Service
	engine        *scheduleEventEngine
	now           func() time.Time
}

func NewSchedulePreviewService(
	profilesRepo profileRepository,
	dayOffService *isdayoff.Service,
	scheduleTimezone ...string,
) *SchedulePreviewService {
	location := loadScheduleLocation(scheduleTimezone...)
	return &SchedulePreviewService{
		profilesRepo:  profilesRepo,
		dayOffService: dayOffService,
		engine:        newScheduleEventEngine(dayOffService, location),
		now: func() time.Time {
			return time.Now().In(location)
		},
	}
}

func (s *SchedulePreviewService) Preview(
	ctx context.Context,
	userID int,
	portfolioID int,
	req *dto.PortfolioRebalanceSchedulePreviewRequest,
) (*dto.PortfolioRebalanceSchedulePreviewResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("%w: empty payload", ErrInvalidRequest)
	}
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if s.profilesRepo == nil || s.dayOffService == nil || s.engine == nil {
		return nil, ErrSchedulePreviewUnavailable
	}

	if _, err := s.profilesRepo.GetByID(userID, portfolioID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProfileNotFound
		}
		return nil, err
	}

	plan, err := prepareSchedulePreviewPlan(req, s.now, s.engine.location)
	if err != nil {
		return nil, err
	}

	result, err := s.engine.Calculate(ctx, *plan)
	if err != nil {
		return nil, err
	}
	return &dto.PortfolioRebalanceSchedulePreviewResponse{
		Events:   result.Events,
		Calendar: result.Calendar,
	}, nil
}
