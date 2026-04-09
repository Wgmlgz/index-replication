package rebalance

import (
	"context"
	"errors"
	"time"

	"server/internal/api/dto"
	"server/internal/models"

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

	if planningResponse, handled := buildPlanningExecutionStatus(run); handled {
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

func buildPlanningExecutionStatus(run *models.PortfolioRebalanceRun) (*dto.PortfolioRebalanceStatusResponse, bool) {
	if run == nil {
		return nil, false
	}

	progress := dto.PortfolioRebalanceStatusProgress{
		TotalItems:      2,
		ActionableItems: 2,
	}
	switch run.Status {
	case models.PortfolioRebalanceRunStatusPlanningQueued:
		progress.PendingItems = 2
		progress.CompletionPercent = 0
		progress.IsTerminal = false
	case models.PortfolioRebalanceRunStatusPlanning:
		progress.PendingItems = 1
		progress.ExecutingItems = 1
		progress.CompletionPercent = 50
		progress.IsTerminal = false
		if run.StartedAt != nil {
			progress.LastEventAt = cloneTimePtr(run.StartedAt)
		}
	case models.PortfolioRebalanceRunStatusDraft:
		progress.CompletedItems = 2
		progress.CompletionPercent = 100
		progress.IsTerminal = true
		if run.EndedAt != nil {
			progress.LastEventAt = cloneTimePtr(run.EndedAt)
		}
	case models.PortfolioRebalanceRunStatusPlanningFailed:
		progress.CompletedItems = 1
		progress.FailedItems = 1
		progress.CompletionPercent = 100
		progress.IsTerminal = true
		if run.EndedAt != nil {
			progress.LastEventAt = cloneTimePtr(run.EndedAt)
		}
	default:
		return nil, false
	}

	return &dto.PortfolioRebalanceStatusResponse{
		Run:      toRunDTO(run),
		Progress: progress,
		Items:    []dto.PortfolioRebalanceStatusItem{},
		Links:    []dto.PortfolioRebalanceStatusLink{},
	}, true
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
