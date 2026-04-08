package portfolio

import (
	"context"

	"server/internal/api/dto"
)

type Profile struct {
	ID       int
	UserID   int
	Provider string
	Name     string
	Config   map[string]interface{}
	Secret   map[string]interface{}
}

type Provider interface {
	Name() string
	Capabilities(ctx context.Context, profile *Profile) dto.PortfolioCapabilities
	GetSummary(ctx context.Context, profile *Profile) (*dto.PortfolioSummaryResponse, error)
	GetHistory(ctx context.Context, profile *Profile, from string, till string, intervalDays int) ([]dto.PortfolioHistoryPoint, error)
	GetComposition(ctx context.Context, profile *Profile, date string) ([]dto.PortfolioCompositionEntry, error)
	GetCompositionSeries(
		ctx context.Context,
		profile *Profile,
		tickers []string,
		topCount int,
		selectionMode string,
		selectionDate string,
		from string,
		till string,
		intervalDays int,
	) (map[string][]dto.PortfolioCompositionSeriesPoint, error)
	GetOperations(ctx context.Context, profile *Profile, cursor string, limit int32) (*dto.PortfolioOperationsHistoryResponse, error)
	RunAction(ctx context.Context, profile *Profile, action string, payload map[string]interface{}) (map[string]interface{}, error)
}

type CreateProfilePreparer interface {
	PrepareCreateProfile(ctx context.Context, userID int, req *dto.PortfolioProfileCreateRequest) error
}
