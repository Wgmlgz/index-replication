package rebalance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/marketprice"
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

type marketPriceService interface {
	GetDailyAsOfPrices(ctx context.Context, req marketprice.InstrumentRangeRequest) (*marketprice.DailyAsOfSeries, error)
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
	marketPrices    marketPriceService
	providers       map[string]portfolio.Provider
}

func NewSnapshotLoader(
	profilesRepo profileRepository,
	replicationRepo replicationRepository,
	benchmarkRead benchmarkReadService,
	marketPrices marketPriceService,
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
		marketPrices:    marketPrices,
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

	resolvedAsOfAt, err := resolveAsOfDate(asOfDate)
	if err != nil {
		return nil, err
	}
	resolvedAsOfDate := resolvedAsOfAt.Format("2006-01-02")

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
	l.resolvePlannerInstrumentIDs(ctx, provider, providerProfile, holdings, targets)
	instruments := l.resolvePlannerInstruments(ctx, providerProfile.Provider, resolvedAsOfAt, portfolioComposition, targets)
	money := toPlannerMoney(summary)
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
			AsOfAt:            resolvedAsOfAt,
			ModeKey:           modeKey,
			ModeParams:        modeParams,
			InvestableCapital: totalValue,
			Holdings:          holdings,
			Benchmark:         targets,
			Instruments:       instruments,
			Money:             money,
			Params:            typedPlanningParams,
		},
		CashAvailable:  cashAvailable,
		HoldingsCount:  len(holdings),
		BenchmarkCount: len(targets),
	}
	return snapshot, nil
}

func (l *SnapshotLoader) resolvePlannerInstrumentIDs(
	ctx context.Context,
	provider portfolio.Provider,
	profile *portfolio.Profile,
	holdings []planner.Holding,
	targets []planner.BenchmarkConstituent,
) {
	if provider == nil || profile == nil {
		return
	}

	providerName := strings.ToLower(strings.TrimSpace(provider.Name()))
	knownByTicker := map[string]string{}

	addKnown := func(tickerRaw string, instrumentIDRaw string) {
		ticker := strings.ToUpper(strings.TrimSpace(tickerRaw))
		instrumentID := strings.TrimSpace(instrumentIDRaw)
		if ticker == "" || instrumentID == "" {
			return
		}
		if _, exists := knownByTicker[ticker]; exists {
			return
		}
		knownByTicker[ticker] = instrumentID
	}

	applyKnown := func() {
		for i := range holdings {
			ticker := strings.ToUpper(strings.TrimSpace(holdings[i].Ticker))
			if strings.TrimSpace(holdings[i].InstrumentID) != "" || ticker == "" {
				continue
			}
			if resolved := strings.TrimSpace(knownByTicker[ticker]); resolved != "" {
				holdings[i].InstrumentID = resolved
			}
		}
		for i := range targets {
			ticker := strings.ToUpper(strings.TrimSpace(targets[i].Ticker))
			if strings.TrimSpace(targets[i].InstrumentID) != "" || ticker == "" {
				continue
			}
			if resolved := strings.TrimSpace(knownByTicker[ticker]); resolved != "" {
				targets[i].InstrumentID = resolved
			}
		}
	}

	for i := range holdings {
		addKnown(holdings[i].Ticker, holdings[i].InstrumentID)
	}
	for i := range targets {
		addKnown(targets[i].Ticker, targets[i].InstrumentID)
	}
	applyKnown()

	unresolvedTickers := map[string]struct{}{}
	for i := range holdings {
		ticker := strings.ToUpper(strings.TrimSpace(holdings[i].Ticker))
		if ticker == "" || strings.TrimSpace(holdings[i].InstrumentID) != "" {
			continue
		}
		unresolvedTickers[ticker] = struct{}{}
	}
	for i := range targets {
		ticker := strings.ToUpper(strings.TrimSpace(targets[i].Ticker))
		if ticker == "" || strings.TrimSpace(targets[i].InstrumentID) != "" {
			continue
		}
		unresolvedTickers[ticker] = struct{}{}
	}

	if providerName == "tbank" && len(unresolvedTickers) > 0 {
		tickers := make([]string, 0, len(unresolvedTickers))
		for ticker := range unresolvedTickers {
			tickers = append(tickers, ticker)
		}
		sort.Strings(tickers)

		for _, ticker := range tickers {
			result, err := provider.RunAction(ctx, profile, "resolve_instrument", map[string]interface{}{
				"action_id": "snapshot-resolve-" + ticker,
				"ticker":    ticker,
				"side":      "buy",
			})
			if err != nil {
				continue
			}
			resolved := strings.TrimSpace(actionResultString(result, "instrument_id"))
			if resolved == "" {
				continue
			}
			knownByTicker[ticker] = resolved
		}
		applyKnown()
	}

	if providerName != "tbank" {
		for i := range holdings {
			if strings.TrimSpace(holdings[i].InstrumentID) != "" {
				continue
			}
			ticker := strings.ToUpper(strings.TrimSpace(holdings[i].Ticker))
			if ticker == "" {
				continue
			}
			holdings[i].InstrumentID = ticker
		}
		for i := range targets {
			if strings.TrimSpace(targets[i].InstrumentID) != "" {
				continue
			}
			ticker := strings.ToUpper(strings.TrimSpace(targets[i].Ticker))
			if ticker == "" {
				continue
			}
			targets[i].InstrumentID = ticker
		}
	}
}

func actionResultString(result map[string]interface{}, key string) string {
	if len(result) == 0 {
		return ""
	}
	raw, ok := result[key]
	if !ok || raw == nil {
		return ""
	}
	value, ok := raw.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(value)
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

func resolveAsOfDate(value string) (time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		now := time.Now().UTC()
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC), nil
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return time.Time{}, ErrInvalidAsOfDate
	}
	utc := parsed.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC), nil
}

func toPlannerHoldings(rows []dto.PortfolioCompositionEntry) []planner.Holding {
	holdings := make([]planner.Holding, 0, len(rows))
	for _, row := range rows {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		instrumentID := strings.TrimSpace(row.InstrumentID)
		if ticker == "" {
			ticker = instrumentID
		}
		if ticker == "" {
			continue
		}

		holdings = append(holdings, planner.Holding{
			Ticker:          ticker,
			InstrumentID:    instrumentID,
			CurrentQuantity: row.Quantity,
		})
	}
	return holdings
}

func toPlannerTargets(rows []moexdomain.IndexCompositionEntry) []planner.BenchmarkConstituent {
	targets := make([]planner.BenchmarkConstituent, 0, len(rows))
	for _, row := range rows {
		ticker := strings.ToUpper(strings.TrimSpace(row.Ticker))
		if ticker == "" {
			continue
		}

		targetWeight := 0.0
		if row.Weight != nil {
			targetWeight = *row.Weight
		}

		targets = append(targets, planner.BenchmarkConstituent{
			Ticker:       ticker,
			InstrumentID: "",
			TargetWeight: targetWeight,
		})
	}
	return targets
}

type plannerPriceCandidate struct {
	Ticker       string
	InstrumentID string
}

func (l *SnapshotLoader) resolvePlannerInstruments(
	ctx context.Context,
	provider string,
	asOfAt time.Time,
	composition []dto.PortfolioCompositionEntry,
	targets []planner.BenchmarkConstituent,
) []planner.InstrumentInfo {
	instrumentsByKey := map[string]planner.InstrumentInfo{}
	candidatesByKey := map[string]plannerPriceCandidate{}

	for _, row := range composition {
		ticker, instrumentID, ok := normalizePlannerSymbol(row.Ticker, row.InstrumentID)
		if !ok {
			continue
		}
		key := snapshotInstrumentKey(ticker, instrumentID)
		candidatesByKey[key] = plannerPriceCandidate{Ticker: ticker, InstrumentID: instrumentID}
		if row.CurrentPrice > 0 {
			instrumentsByKey[key] = planner.InstrumentInfo{
				Ticker:       ticker,
				InstrumentID: instrumentID,
				Price:        row.CurrentPrice,
				Currency:     strings.ToUpper(strings.TrimSpace(row.Currency)),
				AsOfAt:       asOfAt,
				Source:       "portfolio_composition",
				LotSize:      1,
			}
		}
	}

	for _, row := range targets {
		ticker, instrumentID, ok := normalizePlannerSymbol(row.Ticker, row.InstrumentID)
		if !ok {
			continue
		}
		key := snapshotInstrumentKey(ticker, instrumentID)
		candidatesByKey[key] = plannerPriceCandidate{Ticker: ticker, InstrumentID: instrumentID}
	}

	if l.marketPrices != nil {
		candidateKeys := make([]string, 0, len(candidatesByKey))
		for key := range candidatesByKey {
			if _, exists := instrumentsByKey[key]; exists {
				continue
			}
			candidateKeys = append(candidateKeys, key)
		}
		sort.Strings(candidateKeys)

		asOfDate := asOfAt.Format("2006-01-02")
		for _, key := range candidateKeys {
			candidate := candidatesByKey[key]
			series, err := l.marketPrices.GetDailyAsOfPrices(ctx, marketprice.InstrumentRangeRequest{
				Provider:      strings.ToLower(strings.TrimSpace(provider)),
				InstrumentKey: candidate.InstrumentID,
				Ticker:        candidate.Ticker,
				Secid:         candidate.Ticker,
				From:          asOfAt,
				To:            asOfAt,
			})
			if err != nil || series == nil {
				continue
			}
			price, ok := series.Prices[asOfDate]
			if !ok || price <= 0 {
				continue
			}
			instrumentsByKey[key] = planner.InstrumentInfo{
				Ticker:       candidate.Ticker,
				InstrumentID: candidate.InstrumentID,
				Price:        price,
				Currency:     "",
				AsOfAt:       asOfAt,
				Source:       "market_asof",
				LotSize:      1,
			}
		}
	}

	keys := make([]string, 0, len(instrumentsByKey))
	for key := range instrumentsByKey {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	result := make([]planner.InstrumentInfo, 0, len(keys))
	for _, key := range keys {
		result = append(result, instrumentsByKey[key])
	}
	return result
}

func normalizePlannerSymbol(tickerRaw string, instrumentIDRaw string) (string, string, bool) {
	ticker := strings.ToUpper(strings.TrimSpace(tickerRaw))
	instrumentID := strings.TrimSpace(instrumentIDRaw)
	if ticker == "" {
		ticker = instrumentID
	}
	if ticker == "" {
		return "", "", false
	}
	return ticker, instrumentID, true
}

func snapshotInstrumentKey(ticker string, instrumentID string) string {
	ticker = strings.ToUpper(strings.TrimSpace(ticker))
	instrumentID = strings.TrimSpace(instrumentID)
	if ticker != "" {
		return ticker
	}
	return instrumentID
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

func toPlannerMoney(summary *dto.PortfolioSummaryResponse) []planner.Money {
	if summary == nil || len(summary.Money) == 0 {
		return []planner.Money{}
	}
	result := make([]planner.Money, 0, len(summary.Money))
	for _, row := range summary.Money {
		currency := strings.ToUpper(strings.TrimSpace(row.Currency))
		if currency == "" {
			continue
		}
		result = append(result, planner.Money{
			Currency:  currency,
			Available: row.Available,
			Blocked:   row.Blocked,
		})
	}
	return result
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
