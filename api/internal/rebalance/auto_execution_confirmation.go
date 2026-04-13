package rebalance

import (
	"context"

	"server/internal/api/dto"
)

type AutoExecutionConfirmationRequest struct {
	UserID       int
	PortfolioID  int
	RunID        int
	AsOfDate     string
	Transactions []dto.PortfolioRebalanceTransaction
}

type autoExecutionConfirmationRequester interface {
	RequestRebalanceExecutionConfirmation(
		ctx context.Context,
		req AutoExecutionConfirmationRequest,
	) error
}
