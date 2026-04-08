package rebalance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/rebalance/planner"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type runRepository interface {
	CreateRun(run *models.PortfolioRebalanceRun) (*models.PortfolioRebalanceRun, error)
	ListRunsByPortfolio(userID int, portfolioProfileID int, limit int) ([]models.PortfolioRebalanceRun, error)
	GetRunByID(userID int, portfolioProfileID int, runID int) (*models.PortfolioRebalanceRun, error)
	DeleteRunByID(userID int, portfolioProfileID int, runID int) error
	MarkRunExecutionStarted(userID int, portfolioProfileID int, runID int, startedAt time.Time) error
	MarkRunExecutionFinished(userID int, portfolioProfileID int, runID int, status string, endedAt time.Time) error
}

type auditLogger interface {
	LogUserAction(performedBy int, action string, userID int, details interface{}) error
}

type plannerService interface {
	Plan(input planner.Input) (planner.Output, error)
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
	executor ...ExecutionStarter,
) *Service {
	var executionStarter ExecutionStarter
	if len(executor) > 0 {
		executionStarter = executor[0]
	}
	return &Service{
		profilesRepo:   profilesRepo,
		runsRepo:       runsRepo,
		snapshotLoader: snapshotLoader,
		planner:        planner,
		audit:          audit,
		executor:       executionStarter,
	}
}

func (s *Service) CreateDraft(
	ctx context.Context,
	userID int,
	portfolioID int,
	req *dto.PortfolioRebalanceCreateRequest,
) (*dto.PortfolioRebalanceDetailResponse, error) {
	if req == nil {
		return nil, ErrInvalidRequest
	}
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}

	executionMode, err := normalizeExecutionMode(req.ExecutionMode)
	if err != nil {
		return nil, err
	}
	planningParams, planningParamsSnapshot := normalizePlanningParams(req.PlanningParams)
	confirmationRequired := executionMode == models.PortfolioRebalanceExecutionModeManual
	if req.ConfirmationRequired != nil {
		confirmationRequired = *req.ConfirmationRequired
	}

	startedAt := time.Now().UTC()
	snapshot, err := s.snapshotLoader.Load(ctx, userID, portfolioID, req.AsOfDate, req.PlanningParams)
	if err != nil {
		s.logPlanningFailed(userID, portfolioID, executionMode, req.AsOfDate, err)
		return nil, err
	}
	snapshot.PlanningParams = planningParams
	snapshot.PlanningParamsSnapshot = planningParamsSnapshot
	snapshot.PlannerInput.Params = planningParams

	planOutput, err := s.planner.Plan(snapshot.PlannerInput)
	if err != nil {
		s.logPlanningFailed(userID, portfolioID, executionMode, snapshot.AsOfDate, err)
		return nil, fmt.Errorf("%w: %v", ErrPlanningFailed, err)
	}
	if len(snapshot.Warnings) > 0 {
		planOutput.Warnings = append(planOutput.Warnings, snapshot.Warnings...)
	}
	endedAt := time.Now().UTC()
	planSummary := planner.BuildSummary(planOutput.Items, snapshot.PlannerInput.InvestableCapital)
	planInputDTO := toPlanInputDTO(snapshot.PlannerInput)
	planOutputDTO := toPlanOutputDTO(planOutput)
	planSummaryDTO := toPlanSummaryDTO(planSummary)

	asOfDate := snapshot.PlannerInput.AsOfAt
	if asOfDate.IsZero() {
		asOfDate = time.Now().UTC()
	}

	inputJSON, err := toJSONMap(planInputDTO)
	if err != nil {
		s.logPlanningFailed(userID, portfolioID, executionMode, snapshot.AsOfDate, err)
		return nil, fmt.Errorf("%w: encode plan input: %v", ErrPlanningFailed, err)
	}
	outputJSON, err := toJSONMap(planOutputDTO)
	if err != nil {
		s.logPlanningFailed(userID, portfolioID, executionMode, snapshot.AsOfDate, err)
		return nil, fmt.Errorf("%w: encode plan output: %v", ErrPlanningFailed, err)
	}
	summaryJSON, err := toJSONMap(planSummaryDTO)
	if err != nil {
		s.logPlanningFailed(userID, portfolioID, executionMode, snapshot.AsOfDate, err)
		return nil, fmt.Errorf("%w: encode plan summary: %v", ErrPlanningFailed, err)
	}
	warnings := planOutput.Warnings
	if warnings == nil {
		warnings = []string{}
	}
	warningsJSON, err := json.Marshal(warnings)
	if err != nil {
		s.logPlanningFailed(userID, portfolioID, executionMode, snapshot.AsOfDate, err)
		return nil, fmt.Errorf("%w: encode plan warnings: %v", ErrPlanningFailed, err)
	}

	runModel := &models.PortfolioRebalanceRun{
		UserID:                        userID,
		PortfolioProfileID:            portfolioID,
		Provider:                      snapshot.Provider,
		BenchmarkSecidSnapshot:        strPtr(snapshot.BenchmarkSecid),
		ReplicationModeKeySnapshot:    snapshot.ModeKey,
		ReplicationModeParamsSnapshot: datatypes.JSONMap(snapshot.ModeParams),
		PlanningParamsSnapshot:        datatypes.JSONMap(snapshot.PlanningParamsSnapshot),
		ExecutionMode:                 executionMode,
		ConfirmationRequired:          confirmationRequired,
		Status:                        models.PortfolioRebalanceRunStatusDraft,
		AsOfDate:                      asOfDate,
		InputJSON:                     inputJSON,
		OutputJSON:                    outputJSON,
		SummaryJSON:                   summaryJSON,
		WarningsJSON:                  datatypes.JSON(warningsJSON),
		StartedAt:                     &startedAt,
		EndedAt:                       &endedAt,
	}

	savedRun, err := s.runsRepo.CreateRun(runModel)
	if err != nil {
		s.logPlanningFailed(userID, portfolioID, executionMode, snapshot.AsOfDate, err)
		return nil, err
	}

	_ = s.audit.LogUserAction(userID, models.ActionPortfolioRebalanceCreated, userID, map[string]interface{}{
		"portfolio_id":          portfolioID,
		"rebalance_run_id":      savedRun.ID,
		"provider":              savedRun.Provider,
		"benchmark_secid":       derefString(savedRun.BenchmarkSecidSnapshot),
		"replication_mode_key":  savedRun.ReplicationModeKeySnapshot,
		"execution_mode":        savedRun.ExecutionMode,
		"confirmation_required": savedRun.ConfirmationRequired,
		"status":                savedRun.Status,
		"items_total":           len(planOutput.Items),
	})

	return toDetailDTO(savedRun)
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

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
