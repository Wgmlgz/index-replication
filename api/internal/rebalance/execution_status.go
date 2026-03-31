package rebalance

import (
	"context"
	"errors"
	"math"
	"time"

	"server/internal/api/dto"
	"server/internal/models"

	"gorm.io/gorm"
)

func (s *Service) GetRunExecutionStatus(
	_ context.Context,
	userID int,
	portfolioID int,
	runID int,
) (*dto.PortfolioRebalanceExecutionStatusResponse, error) {
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

	items, err := s.runsRepo.ListItemsByRunID(runID)
	if err != nil {
		return nil, err
	}
	links, err := s.runsRepo.ListExecutionLinksByRunID(runID)
	if err != nil {
		return nil, err
	}

	latestLinkByItemID := map[int]models.PortfolioRebalanceExecutionLink{}
	for i := range links {
		link := links[i]
		if link.RebalanceItemID == nil || *link.RebalanceItemID <= 0 {
			continue
		}
		latestLinkByItemID[*link.RebalanceItemID] = link
	}

	itemRows := make([]dto.PortfolioRebalanceExecutionItem, 0, len(items))
	progress := dto.PortfolioRebalanceExecutionProgress{}
	progress.TotalItems = len(items)
	progress.IsTerminal = isRunTerminal(run.Status)

	for i := range items {
		item := items[i]
		progress.ActionableItems++

		lastError := ""
		var lastErrorPtr *string
		var lastActionID *string
		var providerOperationID *string
		var lastEventAt *time.Time

		if link, ok := latestLinkByItemID[item.ID]; ok {
			lastError = metadataString(link.MetadataJSON, "error")
			if lastError != "" {
				lastErrorPtr = &lastError
			}

			actionID := metadataString(link.MetadataJSON, "action_id")
			if actionID != "" {
				lastActionID = &actionID
			}

			providerOperationID = cloneStringPtr(link.ProviderOperationID)
			eventAt := link.CreatedAt.UTC()
			lastEventAt = &eventAt
			progress.LastEventAt = laterTimePtr(progress.LastEventAt, lastEventAt)
		}

		switch item.Status {
		case models.PortfolioRebalanceItemStatusUnresolved:
			progress.UnresolvedItems++
			progress.ActionableItems--
		case models.PortfolioRebalanceItemStatusExecuting:
			progress.ExecutingItems++
		case models.PortfolioRebalanceItemStatusCompleted:
			progress.CompletedItems++
		case models.PortfolioRebalanceItemStatusFailed:
			progress.FailedItems++
		default:
			progress.PendingItems++
		}

		itemRows = append(itemRows, dto.PortfolioRebalanceExecutionItem{
			ID:                  item.ID,
			Ticker:              item.Ticker,
			InstrumentID:        item.InstrumentID,
			Side:                item.Side,
			CurrentQuantity:     item.CurrentQuantity,
			TargetQuantity:      item.TargetQuantity,
			DeltaQuantity:       item.DeltaQuantity,
			ReferencePrice:      cloneFloatPtr(item.ReferencePrice),
			PlannedAmount:       cloneFloatPtr(item.PlannedAmount),
			Status:              item.Status,
			LastError:           lastErrorPtr,
			LastActionID:        lastActionID,
			ProviderOperationID: providerOperationID,
			UpdatedAt:           item.UpdatedAt.UTC(),
			LastEventAt:         lastEventAt,
		})
	}

	terminalItems := progress.CompletedItems + progress.FailedItems
	if progress.ActionableItems > 0 {
		progress.CompletionPercent = math.Min(
			100,
			(100*float64(terminalItems))/float64(progress.ActionableItems),
		)
	} else if progress.TotalItems == 0 || progress.IsTerminal {
		progress.CompletionPercent = 100
	}

	linkRows := make([]dto.PortfolioRebalanceExecutionLink, 0, len(links))
	for i := range links {
		link := links[i]
		linkRows = append(linkRows, dto.PortfolioRebalanceExecutionLink{
			ID:                      link.ID,
			RebalanceItemID:         link.RebalanceItemID,
			Status:                  link.Status,
			ProviderOperationID:     cloneStringPtr(link.ProviderOperationID),
			ProviderOperationCursor: cloneStringPtr(link.ProviderOperationCursor),
			Metadata:                copyMetadata(link.MetadataJSON),
			CreatedAt:               link.CreatedAt.UTC(),
			UpdatedAt:               link.UpdatedAt.UTC(),
		})
		progress.LastEventAt = laterTimePtr(progress.LastEventAt, timePtr(link.CreatedAt.UTC()))
	}

	runDTO := toRunDTO(run)
	return &dto.PortfolioRebalanceExecutionStatusResponse{
		Run:      runDTO,
		Progress: progress,
		Items:    itemRows,
		Links:    linkRows,
	}, nil
}

func isRunTerminal(status string) bool {
	switch status {
	case models.PortfolioRebalanceRunStatusCompleted,
		models.PortfolioRebalanceRunStatusPartiallyCompleted,
		models.PortfolioRebalanceRunStatusFailed:
		return true
	default:
		return false
	}
}

func metadataString(metadata map[string]interface{}, key string) string {
	if len(metadata) == 0 {
		return ""
	}
	raw, ok := metadata[key]
	if !ok || raw == nil {
		return ""
	}
	value, ok := raw.(string)
	if !ok {
		return ""
	}
	return value
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

func laterTimePtr(base *time.Time, candidate *time.Time) *time.Time {
	if candidate == nil {
		return base
	}
	if base == nil || candidate.After(*base) {
		copy := *candidate
		return &copy
	}
	return base
}

func timePtr(value time.Time) *time.Time {
	copy := value
	return &copy
}
