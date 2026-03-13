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
	CreateRunWithItems(
		run *models.PortfolioRebalanceRun,
		items []models.PortfolioRebalanceItem,
	) (*models.PortfolioRebalanceRun, []models.PortfolioRebalanceItem, error)
	ListRunsByPortfolio(userID int, portfolioProfileID int, limit int) ([]models.PortfolioRebalanceRun, error)
	GetRunByID(userID int, portfolioProfileID int, runID int) (*models.PortfolioRebalanceRun, error)
	ListItemsByRunID(runID int) ([]models.PortfolioRebalanceItem, error)
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
}

func NewService(
	profilesRepo profileRepository,
	runsRepo runRepository,
	snapshotLoader *SnapshotLoader,
	planner plannerService,
	audit auditLogger,
) *Service {
	return &Service{
		profilesRepo:   profilesRepo,
		runsRepo:       runsRepo,
		snapshotLoader: snapshotLoader,
		planner:        planner,
		audit:          audit,
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
	endedAt := time.Now().UTC()

	asOfDate, parseErr := time.Parse("2006-01-02", snapshot.AsOfDate)
	if parseErr != nil {
		asOfDate = time.Now().UTC()
	}

	summaryJSON := datatypes.JSONMap{
		"items_total":            float64(planOutput.Summary.ItemsTotal),
		"actionable_items":       float64(planOutput.Summary.ActionableItems),
		"unresolved_items":       float64(planOutput.Summary.UnresolvedItems),
		"filtered_zero_delta":    float64(planOutput.Summary.FilteredZeroDelta),
		"estimated_turnover_abs": planOutput.Summary.EstimatedTurnoverAbs,
		"total_portfolio_value":  planOutput.Summary.TotalPortfolioValue,
		"cash_available":         snapshot.CashAvailable,
		"holdings_count":         float64(snapshot.HoldingsCount),
		"benchmark_count":        float64(snapshot.BenchmarkCount),
	}
	warningsJSON, marshalErr := json.Marshal(planOutput.Warnings)
	if marshalErr != nil {
		warningsJSON = []byte("[]")
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
		SummaryJSON:                   summaryJSON,
		WarningsJSON:                  datatypes.JSON(warningsJSON),
		StartedAt:                     &startedAt,
		EndedAt:                       &endedAt,
	}

	itemModels := make([]models.PortfolioRebalanceItem, 0, len(planOutput.Items))
	for _, item := range planOutput.Items {
		metadata := datatypes.JSONMap{}
		for key, value := range item.Metadata {
			metadata[key] = value
		}
		if len(metadata) == 0 {
			metadata = datatypes.JSONMap{}
		}

		itemModels = append(itemModels, models.PortfolioRebalanceItem{
			Ticker:          item.Ticker,
			InstrumentID:    item.InstrumentID,
			Side:            item.Side,
			CurrentQuantity: item.CurrentQuantity,
			TargetQuantity:  item.TargetQuantity,
			DeltaQuantity:   item.DeltaQuantity,
			CurrentWeight:   item.CurrentWeight,
			TargetWeight:    item.TargetWeight,
			ReferencePrice:  cloneFloatPtr(item.ReferencePrice),
			PlannedAmount:   cloneFloatPtr(item.PlannedAmount),
			Status:          item.Status,
			MetadataJSON:    metadata,
		})
	}

	savedRun, savedItems, err := s.runsRepo.CreateRunWithItems(runModel, itemModels)
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
		"items_total":           len(savedItems),
	})

	return &dto.PortfolioRebalanceDetailResponse{
		Run:   toRunDTO(savedRun),
		Items: toItemDTOList(savedItems),
	}, nil
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
	items, err := s.runsRepo.ListItemsByRunID(run.ID)
	if err != nil {
		return nil, err
	}

	return &dto.PortfolioRebalanceDetailResponse{
		Run:   toRunDTO(run),
		Items: toItemDTOList(items),
	}, nil
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
	summary := map[string]interface{}{}
	for key, value := range model.SummaryJSON {
		summary[key] = value
	}

	warnings := make([]string, 0)
	if len(model.WarningsJSON) > 0 {
		_ = json.Unmarshal(model.WarningsJSON, &warnings)
	}
	if warnings == nil {
		warnings = []string{}
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
		Summary:              summary,
		Warnings:             warnings,
		StartedAt:            model.StartedAt,
		EndedAt:              model.EndedAt,
		CreatedAt:            model.CreatedAt,
		UpdatedAt:            model.UpdatedAt,
	}
}

func toItemDTOList(modelsRows []models.PortfolioRebalanceItem) []dto.PortfolioRebalanceItem {
	items := make([]dto.PortfolioRebalanceItem, 0, len(modelsRows))
	for _, model := range modelsRows {
		metadata := map[string]interface{}{}
		for key, value := range model.MetadataJSON {
			metadata[key] = value
		}
		items = append(items, dto.PortfolioRebalanceItem{
			ID:              model.ID,
			RebalanceRunID:  model.RebalanceRunID,
			Ticker:          model.Ticker,
			InstrumentID:    model.InstrumentID,
			Side:            model.Side,
			CurrentQuantity: model.CurrentQuantity,
			TargetQuantity:  model.TargetQuantity,
			DeltaQuantity:   model.DeltaQuantity,
			CurrentWeight:   model.CurrentWeight,
			TargetWeight:    model.TargetWeight,
			ReferencePrice:  model.ReferencePrice,
			PlannedAmount:   model.PlannedAmount,
			Status:          model.Status,
			Metadata:        metadata,
		})
	}
	return items
}

func cloneFloatPtr(value *float64) *float64 {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
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
