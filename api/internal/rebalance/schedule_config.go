package rebalance

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/models"

	"github.com/teambition/rrule-go"
	"gorm.io/gorm"
)

type scheduleConfigRepository interface {
	GetByPortfolioProfileID(profileID int) (*models.PortfolioRebalanceSchedule, error)
	Upsert(schedule *models.PortfolioRebalanceSchedule) (*models.PortfolioRebalanceSchedule, error)
	DeleteByPortfolioProfileID(profileID int) (bool, error)
}

type ScheduleConfigService struct {
	profilesRepo  profileRepository
	schedulesRepo scheduleConfigRepository
}

func NewScheduleConfigService(
	profilesRepo profileRepository,
	schedulesRepo scheduleConfigRepository,
) *ScheduleConfigService {
	return &ScheduleConfigService{
		profilesRepo:  profilesRepo,
		schedulesRepo: schedulesRepo,
	}
}

func (s *ScheduleConfigService) Get(
	_ context.Context,
	userID int,
	portfolioID int,
) (*dto.PortfolioRebalanceScheduleConfigResponse, error) {
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if s.profilesRepo == nil || s.schedulesRepo == nil {
		return nil, ErrScheduleConfigUnavailable
	}
	if err := s.ensureProfileExists(userID, portfolioID); err != nil {
		return nil, err
	}

	row, err := s.schedulesRepo.GetByPortfolioProfileID(portfolioID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrScheduleConfigNotFound
		}
		return nil, err
	}
	return toScheduleConfigDTO(row), nil
}

func (s *ScheduleConfigService) Upsert(
	_ context.Context,
	userID int,
	portfolioID int,
	req *dto.PortfolioRebalanceScheduleConfigUpsertRequest,
) (*dto.PortfolioRebalanceScheduleConfigResponse, error) {
	if req == nil {
		return nil, ErrInvalidRequest
	}
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if s.profilesRepo == nil || s.schedulesRepo == nil {
		return nil, ErrScheduleConfigUnavailable
	}
	if err := s.ensureProfileExists(userID, portfolioID); err != nil {
		return nil, err
	}
	if req.DtStart.IsZero() {
		return nil, fmt.Errorf("%w: dtstart is required", ErrInvalidRequest)
	}

	ruleText, err := normalizeScheduleRRule(req.RRule, req.DtStart)
	if err != nil {
		return nil, err
	}

	row := &models.PortfolioRebalanceSchedule{
		PortfolioProfileID: portfolioID,
		IsEnabled:          req.IsEnabled,
		DtStart:            req.DtStart.UTC(),
		RRule:              ruleText,
	}
	saved, err := s.schedulesRepo.Upsert(row)
	if err != nil {
		if errors.Is(err, gorm.ErrInvalidData) {
			return nil, ErrInvalidRequest
		}
		return nil, err
	}
	return toScheduleConfigDTO(saved), nil
}

func (s *ScheduleConfigService) Delete(
	_ context.Context,
	userID int,
	portfolioID int,
) error {
	if portfolioID <= 0 {
		return ErrInvalidProfileID
	}
	if s.profilesRepo == nil || s.schedulesRepo == nil {
		return ErrScheduleConfigUnavailable
	}
	if err := s.ensureProfileExists(userID, portfolioID); err != nil {
		return err
	}

	_, err := s.schedulesRepo.DeleteByPortfolioProfileID(portfolioID)
	return err
}

func (s *ScheduleConfigService) ensureProfileExists(userID int, portfolioID int) error {
	_, err := s.profilesRepo.GetByID(userID, portfolioID)
	if err == nil {
		return nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrProfileNotFound
	}
	return err
}

func normalizeScheduleRRule(rruleValue string, dtStartValue time.Time) (string, error) {
	ruleText := strings.TrimSpace(rruleValue)
	if ruleText == "" {
		return "", fmt.Errorf("%w: rrule is required", ErrInvalidRequest)
	}
	if strings.HasPrefix(strings.ToUpper(ruleText), "RRULE:") {
		ruleText = strings.TrimSpace(ruleText[len("RRULE:"):])
	}
	options, err := rrule.StrToROption(ruleText)
	if err != nil {
		return "", fmt.Errorf("%w: invalid rrule: %v", ErrInvalidRequest, err)
	}
	options.Dtstart = dtStartValue.UTC()
	if _, err := rrule.NewRRule(*options); err != nil {
		return "", fmt.Errorf("%w: invalid rrule options: %v", ErrInvalidRequest, err)
	}
	return ruleText, nil
}

func toScheduleConfigDTO(model *models.PortfolioRebalanceSchedule) *dto.PortfolioRebalanceScheduleConfigResponse {
	if model == nil {
		return nil
	}
	return &dto.PortfolioRebalanceScheduleConfigResponse{
		IsEnabled: model.IsEnabled,
		DtStart:   model.DtStart,
		RRule:     model.RRule,
		UpdatedAt: model.UpdatedAt,
	}
}
