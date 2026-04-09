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

type ExecutionStarter interface {
	StartRebalancePlanning(ctx context.Context, userID int, portfolioID int, runID int) error
	StartRebalanceExecution(ctx context.Context, userID int, portfolioID int, runID int) error
	GetRebalancePlanningStatus(ctx context.Context, runID int) (*workflows.RebalancePlanningStatus, error)
	GetRebalanceStatus(ctx context.Context, runID int) (*workflows.RebalanceExecutionResult, error)
}

func (s *Service) ExecuteRun(
	ctx context.Context,
	userID int,
	portfolioID int,
	runID int,
) (*dto.PortfolioRebalanceRun, error) {
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
	switch run.Status {
	case models.PortfolioRebalanceRunStatusDraft,
		models.PortfolioRebalanceRunStatusFailed:
	default:
		return nil, ErrRebalanceNotExecutable
	}

	if err := s.executor.StartRebalanceExecution(ctx, userID, portfolioID, runID); err != nil {
		return nil, err
	}

	if s.audit != nil {
		_ = s.audit.LogUserAction(userID, models.ActionPortfolioRebalanceQueued, userID, map[string]interface{}{
			"portfolio_id":     portfolioID,
			"rebalance_run_id": runID,
			"status":           models.PortfolioRebalanceRunStatusQueued,
			"requested_at":     time.Now().UTC().Format(time.RFC3339),
		})
	}

	dtoRun := toRunDTO(run)
	dtoRun.Status = models.PortfolioRebalanceRunStatusQueued
	return &dtoRun, nil
}
