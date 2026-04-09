package rebalance

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"server/internal/api/dto"
	"server/internal/models"
)

type runRepository interface {
	CreateRun(run *models.PortfolioRebalanceRun) (*models.PortfolioRebalanceRun, error)
	ListRunsByPortfolio(userID int, portfolioProfileID int, limit int) ([]models.PortfolioRebalanceRun, error)
	GetRunByID(userID int, portfolioProfileID int, runID int) (*models.PortfolioRebalanceRun, error)
	DeleteRunByID(userID int, portfolioProfileID int, runID int) error
	MarkRunPlanningStarted(userID int, portfolioProfileID int, runID int, startedAt time.Time) error
	MarkRunPlanningFailed(userID int, portfolioProfileID int, runID int, endedAt time.Time) error
	MarkRunPlanningFinished(
		userID int,
		portfolioProfileID int,
		runID int,
		run *models.PortfolioRebalanceRun,
		endedAt time.Time,
	) error
	MarkRunExecutionStarted(userID int, portfolioProfileID int, runID int, startedAt time.Time) error
	MarkRunExecutionFinished(userID int, portfolioProfileID int, runID int, status string, endedAt time.Time) error
}

type auditLogger interface {
	LogUserAction(performedBy int, action string, userID int, details interface{}) error
}

type Service struct {
	profilesRepo   profileRepository
	runsRepo       runRepository
	snapshotLoader *SnapshotLoader
	planner        plannerService
	audit          auditLogger
	executor       ExecutionStarter
}

func NewService(
	profilesRepo profileRepository,
	runsRepo runRepository,
	snapshotLoader *SnapshotLoader,
	planner plannerService,
	audit auditLogger,
	executor ExecutionStarter,
) *Service {
	return &Service{
		profilesRepo:   profilesRepo,
		runsRepo:       runsRepo,
		snapshotLoader: snapshotLoader,
		planner:        planner,
		audit:          audit,
		executor:       executor,
	}
}

func (s *Service) CreateDraft(
	ctx context.Context,
	userID int,
	portfolioID int,
	req *dto.PortfolioRebalanceCreateRequest,
) (*dto.PortfolioRebalanceDetailResponse, error) {
	runModel, err := s.EnqueueDraftPlanning(ctx, userID, portfolioID, req)
	if err != nil {
		return nil, err
	}
	return toDetailDTO(runModel)
}

func (s *Service) ListRuns(
	_ context.Context,
	userID int,
	portfolioID int,
	limit int,
) ([]dto.PortfolioRebalanceRun, error) {
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if err := s.ensureProfileExists(userID, portfolioID); err != nil {
		return nil, err
	}

	runs, err := s.runsRepo.ListRunsByPortfolio(userID, portfolioID, limit)
	if err != nil {
		return nil, err
	}
	result := make([]dto.PortfolioRebalanceRun, 0, len(runs))
	for _, run := range runs {
		copyRun := run
		result = append(result, toRunDTO(&copyRun))
	}
	return result, nil
}

func (s *Service) GetRunDetail(
	_ context.Context,
	userID int,
	portfolioID int,
	runID int,
) (*dto.PortfolioRebalanceDetailResponse, error) {
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if runID <= 0 {
		return nil, ErrInvalidRebalanceID
	}
	if err := s.ensureProfileExists(userID, portfolioID); err != nil {
		return nil, err
	}

	run, err := s.runsRepo.GetRunByID(userID, portfolioID, runID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRebalanceNotFound
		}
		return nil, err
	}
	detail, err := toDetailDTO(run)
	if err != nil {
		return nil, err
	}
	return detail, nil
}

func (s *Service) DeleteDraft(
	_ context.Context,
	userID int,
	portfolioID int,
	runID int,
) error {
	if portfolioID <= 0 {
		return ErrInvalidProfileID
	}
	if runID <= 0 {
		return ErrInvalidRebalanceID
	}
	if err := s.ensureProfileExists(userID, portfolioID); err != nil {
		return err
	}

	if err := s.runsRepo.DeleteRunByID(userID, portfolioID, runID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRebalanceNotFound
		}
		return err
	}

	_ = s.audit.LogUserAction(userID, models.ActionPortfolioRebalanceDeleted, userID, map[string]interface{}{
		"portfolio_id":     portfolioID,
		"rebalance_run_id": runID,
	})

	return nil
}

func (s *Service) ensureProfileExists(userID int, portfolioID int) error {
	_, err := s.profilesRepo.GetByID(userID, portfolioID)
	if err == nil {
		return nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrProfileNotFound
	}
	return err
}

func (s *Service) logPlanningFailed(userID int, portfolioID int, executionMode string, asOfDate string, err error) {
	if s.audit == nil {
		return
	}
	_ = s.audit.LogUserAction(userID, models.ActionPortfolioRebalanceFailed, userID, map[string]interface{}{
		"portfolio_id":   portfolioID,
		"execution_mode": executionMode,
		"as_of_date":     asOfDate,
		"error":          err.Error(),
	})
}

func toRunDTO(model *models.PortfolioRebalanceRun) dto.PortfolioRebalanceRun {
	modeParams := map[string]interface{}{}
	for key, value := range model.ReplicationModeParamsSnapshot {
		modeParams[key] = value
	}
	planningParams := map[string]interface{}{}
	for key, value := range model.PlanningParamsSnapshot {
		planningParams[key] = value
	}

	return dto.PortfolioRebalanceRun{
		ID:                   model.ID,
		PortfolioID:          model.PortfolioProfileID,
		Provider:             model.Provider,
		BenchmarkSecid:       model.BenchmarkSecidSnapshot,
		ModeKey:              model.ReplicationModeKeySnapshot,
		ModeParams:           modeParams,
		PlanningParams:       planningParams,
		ExecutionMode:        model.ExecutionMode,
		ConfirmationRequired: model.ConfirmationRequired,
		Status:               model.Status,
		AsOfDate:             model.AsOfDate.UTC().Format("2006-01-02"),
		StartedAt:            model.StartedAt,
		EndedAt:              model.EndedAt,
		CreatedAt:            model.CreatedAt,
		UpdatedAt:            model.UpdatedAt,
	}
}

func strPtr(value string) *string {
	trimmed := value
	return &trimmed
}
