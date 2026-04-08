package marketprice

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"server/internal/models"
	moexdomain "server/internal/moex/domain"
	"server/internal/repository"

	"golang.org/x/sync/singleflight"
)

const (
	coverageDatasetSecurityHistory = "security_history"
	defaultMoexBoard               = "TQBR"
	asOfPrefetchPaddingDays        = 32
	asOfSeedBackfillDays           = 370
)

var secidCandidatePattern = regexp.MustCompile(`^[A-Z0-9._-]{1,24}$`)

type InstrumentRangeRequest struct {
	Provider      string
	InstrumentKey string
	Ticker        string
	Secid         string
	Board         string
	Currency      string
	From          time.Time
	To            time.Time
}

type DailyAsOfSeries struct {
	Provider      string
	InstrumentKey string
	Secid         string
	Board         string
	Currency      string
	Prices        map[string]float64
}

type securityHistoryFetcher interface {
	GetShareSecurityHistory(ctx context.Context, secid, board, from, till string) ([]moexdomain.IndexHistoryPoint, error)
	GetShareSecurityCurrency(ctx context.Context, secid, board string) (string, error)
}

type Service struct {
	repo           *repository.MarketPriceRepository
	coverageReader *repository.MoexDataRepository
	coverageWriter *repository.MoexSyncRepository
	fetcher        securityHistoryFetcher
	singleflight   singleflight.Group
}

func NewService(
	repo *repository.MarketPriceRepository,
	coverageReader *repository.MoexDataRepository,
	coverageWriter *repository.MoexSyncRepository,
	fetcher securityHistoryFetcher,
) *Service {
	return &Service{
		repo:           repo,
		coverageReader: coverageReader,
		coverageWriter: coverageWriter,
		fetcher:        fetcher,
	}
}

func (s *Service) GetDailyAsOfPrices(ctx context.Context, req InstrumentRangeRequest) (*DailyAsOfSeries, error) {
	fromDate := normalizeDate(req.From)
	toDate := normalizeDate(req.To)
	if fromDate.After(toDate) {
		fromDate, toDate = toDate, fromDate
	}

	mapping, err := s.resolveMapping(ctx, req)
	if err != nil {
		return nil, err
	}
	if mapping == nil {
		return &DailyAsOfSeries{
			Provider:      strings.ToLower(strings.TrimSpace(req.Provider)),
			InstrumentKey: strings.ToUpper(strings.TrimSpace(req.InstrumentKey)),
			Currency:      normalizeMarketCurrency(req.Currency),
			Prices:        map[string]float64{},
		}, nil
	}

	fetchFrom := fromDate.AddDate(0, 0, -asOfPrefetchPaddingDays)
	if err := s.ensureCoverageCached(ctx, mapping.Secid, mapping.Board, fetchFrom, toDate); err != nil {
		return nil, err
	}

	// If we still don't have a seed quote <= fromDate, backfill one larger historical window once.
	seedRow, err := s.repo.GetLatestSecurityCloseOnOrBefore(ctx, mapping.Secid, mapping.Board, fromDate)
	if err != nil {
		return nil, err
	}
	if seedRow == nil {
		seedFrom := fromDate.AddDate(0, 0, -asOfSeedBackfillDays)
		seedTill := fromDate.AddDate(0, 0, -1)
		if !seedTill.Before(seedFrom) {
			if err := s.ensureCoverageCached(ctx, mapping.Secid, mapping.Board, seedFrom, seedTill); err != nil {
				return nil, err
			}
		}
	}

	readFrom := fromDate.AddDate(0, 0, -asOfSeedBackfillDays)
	rows, err := s.repo.ListSecurityHistory(ctx, mapping.Secid, mapping.Board, &readFrom, &toDate)
	if err != nil {
		return nil, err
	}

	return &DailyAsOfSeries{
		Provider:      mapping.Provider,
		InstrumentKey: mapping.InstrumentKey,
		Secid:         mapping.Secid,
		Board:         mapping.Board,
		Currency:      mappingCurrencyValue(mapping),
		Prices:        alignAsOfDaily(rows, fromDate, toDate),
	}, nil
}

func (s *Service) ensureCoverageCached(ctx context.Context, secid, board string, fromDate, toDate time.Time) error {
	entityKey := securityCoverageEntityKey(secid, board)
	_, missing, err := s.coverageReader.EvaluateCoverage(ctx, coverageDatasetSecurityHistory, entityKey, fromDate, toDate)
	if err != nil {
		return err
	}
	for _, gap := range missing {
		gapFrom := normalizeDate(gap.FromDate)
		gapTo := normalizeDate(gap.ToDate)
		if gapFrom.After(gapTo) {
			gapFrom, gapTo = gapTo, gapFrom
		}
		if err := s.fetchAndStoreGap(ctx, secid, board, gapFrom, gapTo); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) fetchAndStoreGap(ctx context.Context, secid, board string, fromDate, toDate time.Time) error {
	key := fmt.Sprintf("%s|%s|%s|%s", strings.ToUpper(secid), strings.ToUpper(board), fromDate.Format("2006-01-02"), toDate.Format("2006-01-02"))
	_, err, _ := s.singleflight.Do(key, func() (interface{}, error) {
		entityKey := securityCoverageEntityKey(secid, board)
		hasCoverage, err := s.coverageWriter.HasCompleteCoverage(ctx, coverageDatasetSecurityHistory, entityKey, fromDate, toDate)
		if err != nil {
			return nil, err
		}
		if hasCoverage {
			return nil, nil
		}

		points, err := s.fetcher.GetShareSecurityHistory(
			ctx,
			secid,
			board,
			fromDate.Format("2006-01-02"),
			toDate.Format("2006-01-02"),
		)
		if err != nil {
			return nil, err
		}
		if _, err := s.repo.UpsertSecurityHistory(ctx, secid, board, points); err != nil {
			return nil, err
		}
		if err := s.coverageWriter.UpsertCoverage(ctx, coverageDatasetSecurityHistory, entityKey, fromDate, toDate, true); err != nil {
			return nil, err
		}
		return nil, nil
	})
	return err
}

func (s *Service) resolveMapping(ctx context.Context, req InstrumentRangeRequest) (*models.PortfolioInstrumentMappingDB, error) {
	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	instrumentKey := strings.ToUpper(strings.TrimSpace(req.InstrumentKey))
	ticker := strings.ToUpper(strings.TrimSpace(req.Ticker))
	if instrumentKey == "" {
		instrumentKey = ticker
	}
	if provider == "" || instrumentKey == "" {
		return nil, nil
	}

	existing, err := s.repo.GetInstrumentMapping(ctx, provider, instrumentKey)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if err := s.hydrateMappingCurrency(ctx, existing, req); err != nil {
			return nil, err
		}
		return existing, nil
	}

	secid := strings.ToUpper(strings.TrimSpace(req.Secid))
	if secid == "" && ticker != "" {
		secid = ticker
	}
	if secid == "" && secidCandidatePattern.MatchString(instrumentKey) {
		secid = instrumentKey
	}
	if secid == "" {
		return nil, nil
	}

	board := strings.ToUpper(strings.TrimSpace(req.Board))
	if board == "" {
		board = defaultMoexBoard
	}

	row := &models.PortfolioInstrumentMappingDB{
		Provider:      provider,
		InstrumentKey: instrumentKey,
		Currency:      normalizedCurrencyPointer(req.Currency),
		Secid:         secid,
		Board:         board,
	}
	if ticker != "" {
		row.Ticker = &ticker
	}
	if err := s.hydrateMappingCurrency(ctx, row, req); err != nil {
		return nil, err
	}

	if err := s.repo.UpsertInstrumentMapping(ctx, row); err != nil {
		return nil, err
	}
	return row, nil
}

func (s *Service) hydrateMappingCurrency(
	ctx context.Context,
	mapping *models.PortfolioInstrumentMappingDB,
	req InstrumentRangeRequest,
) error {
	if mapping == nil {
		return nil
	}

	if currency := normalizeMarketCurrency(req.Currency); currency != "" {
		if mapping.Currency == nil || strings.TrimSpace(*mapping.Currency) != currency {
			mapping.Currency = &currency
			return s.repo.UpsertInstrumentMapping(ctx, mapping)
		}
		return nil
	}

	currentCurrency := mappingCurrencyValue(mapping)
	if currentCurrency != "" {
		if mapping.Currency == nil || strings.TrimSpace(*mapping.Currency) != currentCurrency {
			mapping.Currency = &currentCurrency
			return s.repo.UpsertInstrumentMapping(ctx, mapping)
		}
		return nil
	}

	if s.fetcher == nil {
		return nil
	}
	resolved, err := s.fetcher.GetShareSecurityCurrency(ctx, mapping.Secid, mapping.Board)
	if err != nil {
		return nil
	}
	resolved = normalizeMarketCurrency(resolved)
	if resolved == "" {
		return nil
	}
	mapping.Currency = &resolved
	return s.repo.UpsertInstrumentMapping(ctx, mapping)
}

func mappingCurrencyValue(mapping *models.PortfolioInstrumentMappingDB) string {
	if mapping == nil || mapping.Currency == nil {
		return ""
	}
	return normalizeMarketCurrency(*mapping.Currency)
}

func normalizedCurrencyPointer(value string) *string {
	currency := normalizeMarketCurrency(value)
	if currency == "" {
		return nil
	}
	return &currency
}

func normalizeMarketCurrency(value string) string {
	currency := strings.ToUpper(strings.TrimSpace(value))
	switch currency {
	case "":
		return ""
	case "SUR", "RUR":
		return "RUB"
	default:
		return currency
	}
}

func alignAsOfDaily(rows []models.MoexSecurityHistoryPointRow, fromDate, toDate time.Time) map[string]float64 {
	if fromDate.After(toDate) {
		fromDate, toDate = toDate, fromDate
	}
	if len(rows) == 0 {
		return map[string]float64{}
	}

	sort.Slice(rows, func(i, j int) bool {
		return rows[i].TradeDate.Before(rows[j].TradeDate)
	})

	prices := make(map[string]float64)
	rowIndex := 0
	var lastClose float64
	hasLastClose := false

	for day := fromDate; !day.After(toDate); day = day.AddDate(0, 0, 1) {
		for rowIndex < len(rows) {
			rowDate := normalizeDate(rows[rowIndex].TradeDate)
			if rowDate.After(day) {
				break
			}
			if rows[rowIndex].Close != nil {
				lastClose = *rows[rowIndex].Close
				hasLastClose = true
			}
			rowIndex++
		}
		if hasLastClose {
			prices[day.Format("2006-01-02")] = lastClose
		}
	}
	return prices
}

func securityCoverageEntityKey(secid, board string) string {
	return fmt.Sprintf("%s:%s", strings.ToUpper(strings.TrimSpace(board)), strings.ToUpper(strings.TrimSpace(secid)))
}

func normalizeDate(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}
