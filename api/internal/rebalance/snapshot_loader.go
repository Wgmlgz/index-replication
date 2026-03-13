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
	"server/internal/moex"
	moexdomain "server/internal/moex/domain"
	"server/internal/portfolio"
	"server/internal/rebalance/planner"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type profileRepository interface {
	GetByID(userID int, id int) (*models.PortfolioProfile, error)
}

type replicationRepository interface {
	GetByPortfolioProfileID(profileID int) (*models.PortfolioReplicationConfig, error)
	BenchmarkExists(secid string) (bool, error)
}

type benchmarkReadService interface {
	GetIndexComposition(ctx context.Context, indexID, date, lang string) ([]moexdomain.IndexCompositionEntry, *moex.MoexCoverageMeta, error)
}

type PlanningSnapshot struct {
	UserID                 int
	PortfolioProfileID     int
	Provider               string
	BenchmarkSecid         string
	ModeKey                string
	ModeParams             map[string]interface{}
	AsOfDate               string
	PlanningParams         planner.PlanningParams
	PlanningParamsSnapshot map[string]interface{}
	PlannerInput           planner.Input
	CashAvailable          float64
	HoldingsCount          int
	BenchmarkCount         int
}

type SnapshotLoader struct {
	profilesRepo    profileRepository
	replicationRepo replicationRepository
	benchmarkRead   benchmarkReadService
	providers       map[string]portfolio.Provider
}

func NewSnapshotLoader(
	profilesRepo profileRepository,
	replicationRepo replicationRepository,
	benchmarkRead benchmarkReadService,
	providers ...portfolio.Provider,
) *SnapshotLoader {
	registry := make(map[string]portfolio.Provider, len(providers))
	for _, provider := range providers {
		if provider == nil {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(provider.Name()))
		if key == "" {
			continue
		}
		registry[key] = provider
	}

	return &SnapshotLoader{
		profilesRepo:    profilesRepo,
		replicationRepo: replicationRepo,
		benchmarkRead:   benchmarkRead,
		providers:       registry,
	}
}

func (l *SnapshotLoader) Load(
	ctx context.Context,
	userID int,
	portfolioID int,
	asOfDate string,
	planningParams map[string]interface{},
) (*PlanningSnapshot, error) {
	if portfolioID <= 0 {
		return nil, ErrInvalidProfileID
	}

	resolvedAsOfDate, err := resolveAsOfDate(asOfDate)
	if err != nil {
		return nil, err
	}

	profileModel, err := l.profilesRepo.GetByID(userID, portfolioID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProfileNotFound
		}
		return nil, err
	}

	providerProfile, err := parseProviderProfile(profileModel)
	if err != nil {
		return nil, fmt.Errorf("%w: parse profile config: %v", ErrPlanningFailed, err)
	}

	provider, ok := l.providers[strings.ToLower(strings.TrimSpace(providerProfile.Provider))]
	if !ok {
		return nil, ErrProviderNotFound
	}

	replicationConfig, err := l.replicationRepo.GetByPortfolioProfileID(portfolioID)
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
		benchmarkSecid = strings.ToUpper(strings.TrimSpace(*replicationConfig.BenchmarkSecid))
	}
	if benchmarkSecid == "" {
		return nil, ErrBenchmarkNotConfigured
	}

	exists, err := l.replicationRepo.BenchmarkExists(benchmarkSecid)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrBenchmarkNotFound
	}

	portfolioComposition, err := provider.GetComposition(ctx, providerProfile, resolvedAsOfDate)
	if err != nil {
		return nil, fmt.Errorf("%w: provider composition read: %v", ErrPlanningFailed, err)
	}

	summary, err := provider.GetSummary(ctx, providerProfile)
	if err != nil {
		return nil, fmt.Errorf("%w: provider summary read: %v", ErrPlanningFailed, err)
	}

	benchmarkComposition, _, err := l.benchmarkRead.GetIndexComposition(ctx, benchmarkSecid, resolvedAsOfDate, "en")
	if err != nil {
		return nil, fmt.Errorf("%w: benchmark composition read: %v", ErrPlanningFailed, err)
	}

	typedPlanningParams, planningParamsSnapshot := normalizePlanningParams(planningParams)
	holdings := toPlannerHoldings(portfolioComposition)
	targets := toPlannerTargets(benchmarkComposition)
	totalValue := resolvePortfolioTotalValue(summary, portfolioComposition)
	cashAvailable := resolveCashAvailable(summary)
	modeParams := mapFromJSONMap(replicationConfig.ModeParams)
	modeKey := strings.ToLower(strings.TrimSpace(replicationConfig.ModeKey))
	if modeKey == "" {
		modeKey = "full"
	}

	snapshot := &PlanningSnapshot{
		UserID:                 userID,
		PortfolioProfileID:     portfolioID,
		Provider:               providerProfile.Provider,
		BenchmarkSecid:         benchmarkSecid,
		ModeKey:                modeKey,
		ModeParams:             modeParams,
		AsOfDate:               resolvedAsOfDate,
		PlanningParams:         typedPlanningParams,
		PlanningParamsSnapshot: planningParamsSnapshot,
		PlannerInput: planner.Input{
			AsOfDate:            resolvedAsOfDate,
			ModeKey:             modeKey,
			ModeParams:          modeParams,
			TotalPortfolioValue: totalValue,
			Holdings:            holdings,
			Benchmark:           targets,
			Params:              typedPlanningParams,
		},
		CashAvailable:  cashAvailable,
		HoldingsCount:  len(holdings),
		BenchmarkCount: len(targets),
	}
	return snapshot, nil
}

func parseProviderProfile(model *models.PortfolioProfile) (*portfolio.Profile, error) {
	if model == nil {
		return nil, ErrInvalidRequest
	}
	config, err := decodeJSONMap(model.ConfigJSON)
	if err != nil {
		return nil, err
	}
	secret, err := decodeJSONMap(model.SecretJSON)
	if err != nil {
		return nil, err
	}
	return &portfolio.Profile{
		ID:       model.ID,
		UserID:   model.UserID,
		Provider: strings.ToLower(strings.TrimSpace(model.Provider)),
		Name:     model.Name,
		Config:   config,
		Secret:   secret,
	}, nil
}

func decodeJSONMap(value string) (map[string]interface{}, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return map[string]interface{}{}, nil
	}

	var decoded map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &decoded); err != nil {
		return nil, err
	}
	if decoded == nil {
		return map[string]interface{}{}, nil
	}
	return decoded, nil
}

func resolveAsOfDate(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Now().UTC().Format("2006-01-02"), nil
	}
	if _, err := time.Parse("2006-01-02", trimmed); err != nil {
		return "", ErrInvalidAsOfDate
	}
	return trimmed, nil
}

func toPlannerHoldings(rows []dto.PortfolioCompositionEntry) []planner.Holding {
	holdings := make([]planner.Holding, 0, len(rows))
	for _, row := range rows {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		instrumentID := strings.ToUpper(strings.TrimSpace(row.InstrumentID))
		if instrumentID == "" {
			instrumentID = ticker
		}
		if ticker == "" {
			ticker = instrumentID
		}
		if instrumentID == "" {
			continue
		}

		var referencePrice *float64
		if row.CurrentPrice > 0 {
			copy := row.CurrentPrice
			referencePrice = &copy
		}

		holdings = append(holdings, planner.Holding{
			Ticker:          ticker,
			InstrumentID:    instrumentID,
			CurrentQuantity: row.Quantity,
			CurrentWeight:   row.Weight,
			ReferencePrice:  referencePrice,
		})
	}
	return holdings
}

func toPlannerTargets(rows []moexdomain.IndexCompositionEntry) []planner.BenchmarkConstituent {
	targets := make([]planner.BenchmarkConstituent, 0, len(rows))
	for _, row := range rows {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		instrumentID := strings.ToUpper(strings.TrimSpace(row.SecID))
		if instrumentID == "" {
			instrumentID = ticker
		}
		if ticker == "" {
			ticker = instrumentID
		}
		if instrumentID == "" {
			continue
		}

		var targetWeight *float64
		if row.Weight != nil {
			copy := *row.Weight
			targetWeight = &copy
		}

		targets = append(targets, planner.BenchmarkConstituent{
			Ticker:       ticker,
			InstrumentID: instrumentID,
			TargetWeight: targetWeight,
		})
	}
	return targets
}

func resolvePortfolioTotalValue(
	summary *dto.PortfolioSummaryResponse,
	composition []dto.PortfolioCompositionEntry,
) float64 {
	if summary != nil && summary.TotalAmountPortfolio > 0 {
		return summary.TotalAmountPortfolio
	}

	total := 0.0
	for _, row := range composition {
		if row.CurrentValue > 0 {
			total += row.CurrentValue
		}
	}
	if total > 0 {
		return total
	}

	for _, row := range composition {
		if row.CurrentPrice <= 0 || row.Quantity <= 0 {
			continue
		}
		total += row.CurrentPrice * row.Quantity
	}
	return total
}

func resolveCashAvailable(summary *dto.PortfolioSummaryResponse) float64 {
	if summary == nil {
		return 0
	}
	cash := 0.0
	for _, row := range summary.Money {
		cash += row.Available
	}
	return cash
}

func mapFromJSONMap(value datatypes.JSONMap) map[string]interface{} {
	if len(value) == 0 {
		return map[string]interface{}{}
	}
	result := make(map[string]interface{}, len(value))
	for key, current := range value {
		result[key] = current
	}
	return result
}
