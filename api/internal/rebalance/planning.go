package rebalance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/rebalance/planner"
	"server/internal/workflows"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type plannerService interface {
	Plan(input planner.Input) (planner.Output, error)
}

func (s *Service) EnqueueDraftPlanning(
	ctx context.Context,
	userID int,
	portfolioID int,
	req *dto.PortfolioRebalanceCreateRequest,
) (*models.PortfolioRebalanceRun, error) {
	if req == nil {
		return nil, ErrInvalidRequest
	}
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if s.executor == nil {
		return nil, ErrPlanningUnavailable
	}
	if s.snapshotLoader == nil || s.snapshotLoader.replicationRepo == nil {
		return nil, ErrPlanningUnavailable
	}

	executionMode, err := normalizeExecutionMode(req.ExecutionMode)
	if err != nil {
		return nil, err
	}
	_, planningParamsSnapshot := normalizePlanningParams(req.PlanningParams)
	confirmationRequired := executionMode == models.PortfolioRebalanceExecutionModeManual
	if req.ConfirmationRequired != nil {
		confirmationRequired = *req.ConfirmationRequired
	}

	asOfDate, err := resolveAsOfDate(req.AsOfDate)
	if err != nil {
		return nil, err
	}

	profileModel, err := s.profilesRepo.GetByID(userID, portfolioID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProfileNotFound
		}
		return nil, err
	}
	provider := strings.ToLower(strings.TrimSpace(profileModel.Provider))
	if provider == "" {
		return nil, ErrProviderNotFound
	}
	if _, ok := s.snapshotLoader.providers[provider]; !ok {
		return nil, ErrProviderNotFound
	}

	replicationConfig, err := s.snapshotLoader.replicationRepo.GetByPortfolioProfileID(portfolioID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrReplicationConfigNotFound
		}
		return nil, err
	}
	if !replicationConfig.IsEnabled {
		return nil, ErrReplicationConfigDisabled
	}

	benchmarkSecid := ""
	if replicationConfig.BenchmarkSecid != nil {
		benchmarkSecid = strings.TrimSpace(*replicationConfig.BenchmarkSecid)
	}
	if benchmarkSecid == "" {
		return nil, ErrBenchmarkNotConfigured
	}
	exists, err := s.snapshotLoader.replicationRepo.BenchmarkExists(benchmarkSecid)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrBenchmarkNotFound
	}

	modeParams := mapFromJSONMap(replicationConfig.ModeParams)
	modeKey := strings.ToLower(strings.TrimSpace(replicationConfig.ModeKey))
	if modeKey == "" {
		modeKey = "full"
	}

	runModel := &models.PortfolioRebalanceRun{
		UserID:                        userID,
		PortfolioProfileID:            portfolioID,
		Provider:                      provider,
		BenchmarkSecidSnapshot:        strPtr(benchmarkSecid),
		ReplicationModeKeySnapshot:    modeKey,
		ReplicationModeParamsSnapshot: datatypes.JSONMap(modeParams),
		PlanningParamsSnapshot:        datatypes.JSONMap(planningParamsSnapshot),
		ExecutionMode:                 executionMode,
		ConfirmationRequired:          confirmationRequired,
		Status:                        models.PortfolioRebalanceRunStatusPlanningQueued,
		AsOfDate:                      asOfDate,
	}

	savedRun, err := s.runsRepo.CreateRun(runModel)
	if err != nil {
		return nil, err
	}

	if err := s.executor.StartRebalancePlanning(ctx, userID, portfolioID, savedRun.ID); err != nil {
		endedAt := time.Now().UTC()
		_ = s.runsRepo.MarkRunPlanningFailed(userID, portfolioID, savedRun.ID, endedAt)
		s.logPlanningFailed(userID, portfolioID, executionMode, asOfDate.Format("2006-01-02"), err)
		return nil, err
	}

	_ = s.audit.LogUserAction(userID, models.ActionPortfolioRebalanceCreated, userID, map[string]interface{}{
		"portfolio_id":          portfolioID,
		"rebalance_run_id":      savedRun.ID,
		"provider":              savedRun.Provider,
		"benchmark_secid":       benchmarkSecid,
		"replication_mode_key":  savedRun.ReplicationModeKeySnapshot,
		"execution_mode":        savedRun.ExecutionMode,
		"confirmation_required": savedRun.ConfirmationRequired,
		"status":                savedRun.Status,
		"items_total":           0,
	})

	return savedRun, nil
}

func (s *Service) ProcessDraftPlanningRun(
	ctx context.Context,
	userID int,
	portfolioID int,
	runID int,
	reportProgress func(workflows.RebalancePlanningStatus),
) (*models.PortfolioRebalanceRun, error) {
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if runID <= 0 {
		return nil, ErrInvalidRebalanceID
	}
	if s.snapshotLoader == nil || s.planner == nil {
		return nil, ErrPlanningUnavailable
	}

	runModel, err := s.runsRepo.GetRunByID(userID, portfolioID, runID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRebalanceNotFound
		}
		return nil, err
	}

	switch runModel.Status {
	case models.PortfolioRebalanceRunStatusDraft,
		models.PortfolioRebalanceRunStatusPlanningFailed:
		return runModel, nil
	case models.PortfolioRebalanceRunStatusPlanningQueued,
		models.PortfolioRebalanceRunStatusPlanning:
	default:
		return runModel, fmt.Errorf("%w: unexpected run status %q", ErrPlanningFailed, runModel.Status)
	}

	startedAt := time.Now().UTC()
	if err := s.runsRepo.MarkRunPlanningStarted(userID, portfolioID, runID, startedAt); err != nil {
		return nil, err
	}
	s.reportPlanningProgress(
		reportProgress,
		runID,
		models.PortfolioRebalanceRunStatusPlanning,
		planningProgressStarted(startedAt),
	)

	s.reportPlanningProgress(
		reportProgress,
		runID,
		models.PortfolioRebalanceRunStatusPlanning,
		planningProgressSnapshotLoading(time.Now().UTC()),
	)

	planningParams := mapFromJSONMap(runModel.PlanningParamsSnapshot)
	snapshot, err := s.snapshotLoader.Load(
		ctx,
		userID,
		portfolioID,
		runModel.AsOfDate.UTC().Format("2006-01-02"),
		planningParams,
	)
	if err != nil {
		return s.markPlanningFailedAndReturnRun(
			userID,
			portfolioID,
			runID,
			runModel.ExecutionMode,
			runModel.AsOfDate,
			err,
			reportProgress,
			planningStageCodeSnapshotLoading,
			"Failed while loading snapshot",
		)
	}

	typedPlanningParams, planningParamsSnapshot := normalizePlanningParams(planningParams)
	snapshot.PlanningParams = typedPlanningParams
	snapshot.PlanningParamsSnapshot = planningParamsSnapshot
	snapshot.PlannerInput.Params = typedPlanningParams

	s.reportPlanningProgress(
		reportProgress,
		runID,
		models.PortfolioRebalanceRunStatusPlanning,
		planningProgressAlgorithmRunning(time.Now().UTC()),
	)

	planOutput, err := s.planner.Plan(snapshot.PlannerInput)
	if err != nil {
		planErr := fmt.Errorf("%w: %v", ErrPlanningFailed, err)
		return s.markPlanningFailedAndReturnRun(
			userID,
			portfolioID,
			runID,
			runModel.ExecutionMode,
			snapshot.PlannerInput.AsOfAt,
			planErr,
			reportProgress,
			planningStageCodeAlgorithm,
			"Failed while running planning algorithm",
		)
	}
	if len(snapshot.Warnings) > 0 {
		planOutput.Warnings = append(planOutput.Warnings, snapshot.Warnings...)
	}

	s.reportPlanningProgress(
		reportProgress,
		runID,
		models.PortfolioRebalanceRunStatusPlanning,
		planningProgressEncoding(time.Now().UTC()),
	)

	planSummary := planner.BuildSummary(planOutput.Items, snapshot.PlannerInput.InvestableCapital)
	planInputDTO := toPlanInputDTO(snapshot.PlannerInput)
	planOutputDTO := toPlanOutputDTO(planOutput)
	planSummaryDTO := toPlanSummaryDTO(planSummary)

	inputJSON, err := toJSONMap(planInputDTO)
	if err != nil {
		return s.markPlanningFailedAndReturnRun(
			userID,
			portfolioID,
			runID,
			runModel.ExecutionMode,
			snapshot.PlannerInput.AsOfAt,
			fmt.Errorf("%w: encode plan input: %v", ErrPlanningFailed, err),
			reportProgress,
			planningStageCodeEncoding,
			"Failed while encoding planning input",
		)
	}
	outputJSON, err := toJSONMap(planOutputDTO)
	if err != nil {
		return s.markPlanningFailedAndReturnRun(
			userID,
			portfolioID,
			runID,
			runModel.ExecutionMode,
			snapshot.PlannerInput.AsOfAt,
			fmt.Errorf("%w: encode plan output: %v", ErrPlanningFailed, err),
			reportProgress,
			planningStageCodeEncoding,
			"Failed while encoding planning output",
		)
	}
	summaryJSON, err := toJSONMap(planSummaryDTO)
	if err != nil {
		return s.markPlanningFailedAndReturnRun(
			userID,
			portfolioID,
			runID,
			runModel.ExecutionMode,
			snapshot.PlannerInput.AsOfAt,
			fmt.Errorf("%w: encode plan summary: %v", ErrPlanningFailed, err),
			reportProgress,
			planningStageCodeEncoding,
			"Failed while encoding planning summary",
		)
	}
	warnings := planOutput.Warnings
	if warnings == nil {
		warnings = []string{}
	}
	warningsJSON, err := json.Marshal(warnings)
	if err != nil {
		return s.markPlanningFailedAndReturnRun(
			userID,
			portfolioID,
			runID,
			runModel.ExecutionMode,
			snapshot.PlannerInput.AsOfAt,
			fmt.Errorf("%w: encode plan warnings: %v", ErrPlanningFailed, err),
			reportProgress,
			planningStageCodeEncoding,
			"Failed while encoding planning warnings",
		)
	}

	s.reportPlanningProgress(
		reportProgress,
		runID,
		models.PortfolioRebalanceRunStatusPlanning,
		planningProgressPersisting(time.Now().UTC()),
	)

	endedAt := time.Now().UTC()
	plannedRun := &models.PortfolioRebalanceRun{
		Provider:                      snapshot.Provider,
		BenchmarkSecidSnapshot:        strPtr(snapshot.BenchmarkSecid),
		ReplicationModeKeySnapshot:    snapshot.ModeKey,
		ReplicationModeParamsSnapshot: datatypes.JSONMap(snapshot.ModeParams),
		PlanningParamsSnapshot:        datatypes.JSONMap(snapshot.PlanningParamsSnapshot),
		Status:                        models.PortfolioRebalanceRunStatusDraft,
		AsOfDate:                      snapshot.PlannerInput.AsOfAt,
		InputJSON:                     inputJSON,
		OutputJSON:                    outputJSON,
		SummaryJSON:                   summaryJSON,
		WarningsJSON:                  datatypes.JSON(warningsJSON),
	}
	if plannedRun.AsOfDate.IsZero() {
		plannedRun.AsOfDate = runModel.AsOfDate
	}

	if err := s.runsRepo.MarkRunPlanningFinished(userID, portfolioID, runID, plannedRun, endedAt); err != nil {
		return nil, err
	}

	s.reportPlanningProgress(
		reportProgress,
		runID,
		models.PortfolioRebalanceRunStatusDraft,
		planningProgressCompleted(endedAt),
	)

	return s.runsRepo.GetRunByID(userID, portfolioID, runID)
}

func (s *Service) markPlanningFailedAndReturnRun(
	userID int,
	portfolioID int,
	runID int,
	executionMode string,
	asOfDate time.Time,
	planErr error,
	reportProgress func(workflows.RebalancePlanningStatus),
	failedStageCode string,
	failedStageMessage string,
) (*models.PortfolioRebalanceRun, error) {
	endedAt := time.Now().UTC()
	if err := s.runsRepo.MarkRunPlanningFailed(userID, portfolioID, runID, endedAt); err != nil {
		return nil, err
	}
	s.reportPlanningProgress(
		reportProgress,
		runID,
		models.PortfolioRebalanceRunStatusPlanningFailed,
		planningProgressFailed(failedStageCode, failedStageMessage, endedAt),
	)
	s.logPlanningFailed(userID, portfolioID, executionMode, asOfDate.UTC().Format("2006-01-02"), planErr)
	runModel, err := s.runsRepo.GetRunByID(userID, portfolioID, runID)
	if err != nil {
		return nil, err
	}
	return runModel, nil
}

func (s *Service) reportPlanningProgress(
	reportProgress func(workflows.RebalancePlanningStatus),
	runID int,
	runStatus string,
	progress workflows.RebalancePlanningProgress,
) {
	if reportProgress == nil || runID <= 0 {
		return
	}
	reportProgress(workflows.RebalancePlanningStatus{
		RunID:     runID,
		RunStatus: runStatus,
		Progress:  progress,
	})
}
