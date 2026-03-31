package rebalance

import (
	"context"
	"errors"
	"time"

	"server/internal/api/dto"
	"server/internal/models"

	"gorm.io/gorm"
)

type ExecutionStarter interface {
	StartRebalanceExecution(ctx context.Context, userID int, portfolioID int, runID int) error
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
	case models.PortfolioRebalanceRunStatusCompleted,
		models.PortfolioRebalanceRunStatusPartiallyCompleted:
		return nil, ErrRebalanceNotExecutable
	case models.PortfolioRebalanceRunStatusQueued,
		models.PortfolioRebalanceRunStatusExecuting:
		dtoRun := toRunDTO(run)
		return &dtoRun, nil
	}

	previousStatus := run.Status
	if err := s.runsRepo.SetRunStatus(userID, portfolioID, runID, models.PortfolioRebalanceRunStatusQueued); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRebalanceNotFound
		}
		return nil, err
	}

	if err := s.executor.StartRebalanceExecution(ctx, userID, portfolioID, runID); err != nil {
		_ = s.runsRepo.SetRunStatus(userID, portfolioID, runID, previousStatus)
		return nil, err
	}

	queuedRun, err := s.runsRepo.GetRunByID(userID, portfolioID, runID)
	if err != nil {
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

	dtoRun := toRunDTO(queuedRun)
	return &dtoRun, nil
}
