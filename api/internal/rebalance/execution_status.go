package rebalance

import (
	"context"
	"errors"
	"time"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/workflows"

	"gorm.io/gorm"
)

func (s *Service) GetRunStatus(
	ctx context.Context,
	userID int,
	portfolioID int,
	runID int,
) (*dto.PortfolioRebalanceStatusResponse, error) {
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}
	if runID <= 0 {
		return nil, ErrInvalidRebalanceID
	}
	if s.executor == nil {
		return nil, ErrExecutionUnavailable
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

	var planningState *workflows.RebalancePlanningStatus
	if isPlanningLifecycleStatus(run.Status) {
		state, stateErr := s.executor.GetRebalancePlanningStatus(ctx, runID)
		if stateErr == nil {
			planningState = state
		}
	}
	if planningResponse, handled := buildPlanningExecutionStatus(run, planningState); handled {
		return planningResponse, nil
	}

	state, err := s.executor.GetRebalanceStatus(ctx, runID)
	if err != nil {
		return nil, err
	}

	runDTO := toRunDTO(run)
	runDTO.Status = state.RunStatus
	if state.StartedAt != nil {
		runDTO.StartedAt = state.StartedAt
	}
	if state.EndedAt != nil {
		runDTO.EndedAt = state.EndedAt
	}

	items := make([]dto.PortfolioRebalanceStatusItem, 0, len(state.Items))
	for i := range state.Items {
		row := state.Items[i]
		items = append(items, dto.PortfolioRebalanceStatusItem{
			ID:                  row.ID,
			Ticker:              row.Ticker,
			InstrumentID:        row.InstrumentID,
			Side:                row.Side,
			CurrentQuantity:     row.CurrentQuantity,
			TargetQuantity:      row.TargetQuantity,
			DeltaQuantity:       row.DeltaQuantity,
			ReferencePrice:      cloneFloatPtr(row.ReferencePrice),
			PlannedAmount:       cloneFloatPtr(row.PlannedAmount),
			Status:              row.Status,
			LastError:           cloneStringPtr(row.LastError),
			LastActionID:        cloneStringPtr(row.LastActionID),
			ProviderOperationID: cloneStringPtr(row.ProviderOperationID),
			LastEventAt:         cloneTimePtr(row.LastEventAt),
			UpdatedAt:           updatedAt(row.LastEventAt),
		})
	}

	links := make([]dto.PortfolioRebalanceStatusLink, 0, len(state.Links))
	for i := range state.Links {
		row := state.Links[i]
		links = append(links, dto.PortfolioRebalanceStatusLink{
			ID:                      row.ID,
			RebalanceItemID:         cloneIntPtr(row.RebalanceItemID),
			Status:                  row.Status,
			ProviderOperationID:     cloneStringPtr(row.ProviderOperationID),
			ProviderOperationCursor: cloneStringPtr(row.ProviderOperationCursor),
			Metadata:                copyMetadata(row.Metadata),
			CreatedAt:               row.CreatedAt.UTC(),
			UpdatedAt:               row.UpdatedAt.UTC(),
		})
	}

	progress := dto.PortfolioRebalanceStatusProgress{
		TotalItems:        state.Progress.TotalItems,
		ActionableItems:   state.Progress.ActionableItems,
		UnresolvedItems:   state.Progress.UnresolvedItems,
		PendingItems:      state.Progress.PendingItems,
		ExecutingItems:    state.Progress.ExecutingItems,
		CompletedItems:    state.Progress.CompletedItems,
		FailedItems:       state.Progress.FailedItems,
		CompletionPercent: state.Progress.CompletionPercent,
		StageCode:         state.Progress.StageCode,
		StageMessage:      state.Progress.StageMessage,
		StageIndex:        state.Progress.StageIndex,
		StageTotal:        state.Progress.StageTotal,
		IsTerminal:        state.Progress.IsTerminal,
		LastEventAt:       cloneTimePtr(state.Progress.LastEventAt),
	}

	return &dto.PortfolioRebalanceStatusResponse{
		Run:      runDTO,
		Progress: progress,
		Items:    items,
		Links:    links,
	}, nil
}

func buildPlanningExecutionStatus(
	run *models.PortfolioRebalanceRun,
	planningState *workflows.RebalancePlanningStatus,
) (*dto.PortfolioRebalanceStatusResponse, bool) {
	if run == nil {
		return nil, false
	}

	runDTO := toRunDTO(run)
	if planningState != nil {
		progress := toDTOPlanningProgress(planningState.Progress)
		if planningState.RunStatus != "" {
			runDTO.Status = planningState.RunStatus
		}
		return &dto.PortfolioRebalanceStatusResponse{
			Run:      runDTO,
			Progress: progress,
			Items:    []dto.PortfolioRebalanceStatusItem{},
			Links:    []dto.PortfolioRebalanceStatusLink{},
		}, true
	}

	progressFallback, handled := planningProgressFallbackForRun(run)
	if !handled {
		return nil, false
	}

	return &dto.PortfolioRebalanceStatusResponse{
		Run:      runDTO,
		Progress: toDTOPlanningProgress(progressFallback),
		Items:    []dto.PortfolioRebalanceStatusItem{},
		Links:    []dto.PortfolioRebalanceStatusLink{},
	}, true
}

func isPlanningLifecycleStatus(status string) bool {
	switch status {
	case models.PortfolioRebalanceRunStatusPlanningQueued,
		models.PortfolioRebalanceRunStatusPlanning,
		models.PortfolioRebalanceRunStatusDraft,
		models.PortfolioRebalanceRunStatusPlanningFailed:
		return true
	default:
		return false
	}
}

func toDTOPlanningProgress(
	progress workflows.RebalancePlanningProgress,
) dto.PortfolioRebalanceStatusProgress {
	return dto.PortfolioRebalanceStatusProgress{
		TotalItems:        progress.TotalItems,
		ActionableItems:   progress.ActionableItems,
		PendingItems:      progress.PendingItems,
		ExecutingItems:    progress.ExecutingItems,
		CompletedItems:    progress.CompletedItems,
		FailedItems:       progress.FailedItems,
		CompletionPercent: progress.CompletionPercent,
		StageCode:         progress.StageCode,
		StageMessage:      progress.StageMessage,
		StageIndex:        progress.StageIndex,
		StageTotal:        progress.StageTotal,
		IsTerminal:        progress.IsTerminal,
		LastEventAt:       cloneTimePtr(progress.LastEventAt),
	}
}

func copyMetadata(source map[string]interface{}) map[string]interface{} {
	if len(source) == 0 {
		return map[string]interface{}{}
	}
	result := make(map[string]interface{}, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}

func cloneStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneIntPtr(value *int) *int {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneTimePtr(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	copy := value.UTC()
	return &copy
}

func updatedAt(lastEvent *time.Time) time.Time {
	if lastEvent != nil {
		return lastEvent.UTC()
	}
	return time.Now().UTC()
}
