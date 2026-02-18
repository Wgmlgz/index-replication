package activities

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"server/internal/models"
	"server/internal/repository"
	"server/internal/services"
	"server/internal/workflows"

	"github.com/google/uuid"
	"go.temporal.io/sdk/activity"
	"gorm.io/gorm"
)

const (
	moexDefaultMutableDays           = 30
	moexDefaultHistoryWindowDays     = 120
	moexDefaultCompositionWindowDays = 30
	moexHistoryOverlapDays           = 7
	moexCompositionOverlapDays       = 2
)

type MoexSyncActivities struct {
	moexService         *services.MoexService
	repo                *repository.MoexSyncRepository
	mutableDays         int
	immutableBeforeDate *time.Time
}

type moexDatasetWindowSyncFn func(context.Context, string, time.Time, time.Time) (int, int, error)

type moexSyncHeartbeat struct {
	Secid        string `json:"secid"`
	Dataset      string `json:"dataset"`
	Mode         string `json:"mode,omitempty"`
	Stage        string `json:"stage"`
	Current      int    `json:"current,omitempty"`
	Total        int    `json:"total,omitempty"`
	From         string `json:"from,omitempty"`
	Till         string `json:"till,omitempty"`
	FetchedRows  int    `json:"fetchedRows,omitempty"`
	UpsertedRows int    `json:"upsertedRows,omitempty"`
	Message      string `json:"message,omitempty"`
}

func NewMoexSyncActivities(db *gorm.DB, moexBaseURL string, mutableDays int, immutableBeforeDate string) *MoexSyncActivities {
	if mutableDays <= 0 {
		mutableDays = moexDefaultMutableDays
	}

	var immutable *time.Time
	trimmedImmutable := strings.TrimSpace(immutableBeforeDate)
	if trimmedImmutable != "" {
		if parsed, err := time.Parse("2006-01-02", trimmedImmutable); err == nil {
			normalized := dateOnlyUTC(parsed)
			immutable = &normalized
		}
	}

	return &MoexSyncActivities{
		moexService:         services.NewMoexService(moexBaseURL),
		repo:                repository.NewMoexSyncRepository(db),
		mutableDays:         mutableDays,
		immutableBeforeDate: immutable,
	}
}

func (a *MoexSyncActivities) MetaRefresh(ctx context.Context, mode string) error {
	mode = normalizeMode(mode)
	log.Printf("[Temporal][MOEX] MetaRefresh started mode=%s", mode)
	if err := a.repo.MarkSyncRunning(ctx, "meta", "global"); err != nil {
		return fmt.Errorf("mark meta sync running: %w", err)
	}

	overview, err := a.moexService.GetIndexesOverview(ctx, "en")
	if err != nil {
		_ = a.repo.MarkSyncError(ctx, "meta", "global", err.Error())
		return fmt.Errorf("fetch moex overview: %w", err)
	}

	if err := a.repo.ReplaceOverview(ctx, overview); err != nil {
		_ = a.repo.MarkSyncError(ctx, "meta", "global", err.Error())
		return fmt.Errorf("persist moex overview: %w", err)
	}

	if err := a.repo.MarkSyncSuccess(ctx, "meta", "global"); err != nil {
		return fmt.Errorf("mark meta sync success: %w", err)
	}

	log.Printf("[Temporal][MOEX] MetaRefresh finished mode=%s", mode)
	return nil
}

func (a *MoexSyncActivities) ListIndexSecids(ctx context.Context) ([]string, error) {
	return a.repo.ListIndexSecids(ctx)
}

func (a *MoexSyncActivities) DailySync(ctx context.Context, params workflows.DailySyncParams) error {
	mode := normalizeMode(params.Mode)
	from := strings.TrimSpace(params.From)
	till := strings.TrimSpace(params.Till)
	log.Printf("[Temporal][MOEX] DailySync started mode=%s from=%s till=%s", mode, from, till)

	indexes, err := a.repo.ListIndexSecids(ctx)
	if err != nil {
		return fmt.Errorf("list indexes for daily sync activity: %w", err)
	}
	synced := 0
	for _, index := range indexes {
		secid := strings.TrimSpace(index)
		if secid == "" {
			continue
		}
		if _, _, err := a.syncHistoryRange(ctx, secid, mode, from, till); err != nil {
			return err
		}
		if _, _, err := a.syncCompositionRange(ctx, secid, mode, from, till); err != nil {
			return err
		}
		synced++
	}
	log.Printf("[Temporal][MOEX] DailySync finished mode=%s indexes=%d", mode, synced)
	return nil
}

func (a *MoexSyncActivities) SyncIndex(ctx context.Context, params workflows.SyncIndexParams) (workflows.IndexSyncResult, error) {
	secid := strings.TrimSpace(params.Secid)
	mode := normalizeMode(params.Mode)
	from := strings.TrimSpace(params.From)
	till := strings.TrimSpace(params.Till)
	if secid == "" {
		return workflows.IndexSyncResult{}, fmt.Errorf("empty secid in sync index activity")
	}

	recordSyncHeartbeat(ctx, moexSyncHeartbeat{
		Secid:   secid,
		Mode:    mode,
		Stage:   "index_started",
		Current: params.Index,
		Total:   params.Total,
		From:    from,
		Till:    till,
	})

	historyFetched, historyUpserted, err := a.syncHistoryRange(ctx, secid, mode, from, till)
	if err != nil {
		return workflows.IndexSyncResult{}, err
	}
	compositionFetched, compositionUpserted, err := a.syncCompositionRange(ctx, secid, mode, from, till)
	if err != nil {
		return workflows.IndexSyncResult{}, err
	}

	recordSyncHeartbeat(ctx, moexSyncHeartbeat{
		Secid:        secid,
		Mode:         mode,
		Stage:        "index_completed",
		Current:      params.Index,
		Total:        params.Total,
		From:         from,
		Till:         till,
		FetchedRows:  historyFetched + compositionFetched,
		UpsertedRows: historyUpserted + compositionUpserted,
	})

	return workflows.IndexSyncResult{
		Secid:                   secid,
		HistoryFetchedRows:      historyFetched,
		HistoryUpsertedRows:     historyUpserted,
		CompositionFetchedRows:  compositionFetched,
		CompositionUpsertedRows: compositionUpserted,
	}, nil
}

func (a *MoexSyncActivities) syncHistoryRange(ctx context.Context, secid, mode, fromRaw, tillRaw string) (int, int, error) {
	return a.syncDatasetRange(
		ctx,
		"history",
		secid,
		mode,
		fromRaw,
		tillRaw,
		moexDefaultHistoryWindowDays,
		moexHistoryOverlapDays,
		a.syncHistoryWindow,
	)
}

func (a *MoexSyncActivities) syncCompositionRange(ctx context.Context, secid, mode, fromRaw, tillRaw string) (int, int, error) {
	return a.syncDatasetRange(
		ctx,
		"composition",
		secid,
		mode,
		fromRaw,
		tillRaw,
		moexDefaultCompositionWindowDays,
		moexCompositionOverlapDays,
		a.syncCompositionWindow,
	)
}

func (a *MoexSyncActivities) syncDatasetRange(
	ctx context.Context,
	dataset, secid, mode, fromRaw, tillRaw string,
	defaultWindowDays, overlapDays int,
	syncWindow moexDatasetWindowSyncFn,
) (int, int, error) {
	secid = strings.TrimSpace(secid)
	if secid == "" {
		return 0, 0, fmt.Errorf("empty secid for %s sync", dataset)
	}

	fromDate, tillDate, mutableSince, immutableBefore, err := a.resolveEffectiveRange(ctx, dataset, secid, mode, fromRaw, tillRaw, defaultWindowDays, overlapDays)
	if err != nil {
		return 0, 0, err
	}

	info := activity.GetInfo(ctx)
	runID := uuid.NewString()
	if err := a.repo.StartSyncRun(ctx, runID, info.WorkflowExecution.ID, info.WorkflowExecution.RunID, dataset, secid); err != nil {
		return 0, 0, fmt.Errorf("start %s sync run: %w", dataset, err)
	}
	if err := a.repo.MarkSyncRunning(ctx, dataset, secid); err != nil {
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, 0, 0, err.Error(), "mark running failed")
		return 0, 0, err
	}

	fetchedRows := 0
	upsertedRows := 0
	repairedRanges := 0
	details := fmt.Sprintf("mode=%s from=%s till=%s", mode, fromDate.Format("2006-01-02"), tillDate.Format("2006-01-02"))
	recordSyncHeartbeat(ctx, moexSyncHeartbeat{
		Secid:   secid,
		Dataset: dataset,
		Mode:    mode,
		Stage:   "dataset_started",
		From:    fromDate.Format("2006-01-02"),
		Till:    tillDate.Format("2006-01-02"),
	})

	if mode == "full" {
		hasCompleteCoverage, coverageErr := a.repo.HasCompleteCoverage(ctx, dataset, secid, fromDate, tillDate)
		if coverageErr != nil {
			_ = a.repo.MarkSyncError(ctx, dataset, secid, coverageErr.Error())
			_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, coverageErr.Error(), details)
			return fetchedRows, upsertedRows, fmt.Errorf("check %s coverage: %w", dataset, coverageErr)
		}
		if hasCompleteCoverage {
			details = details + " skipped=already_complete"
			if err := a.repo.MarkSyncSuccessWithState(ctx, dataset, secid, &tillDate, &immutableBefore, &mutableSince); err != nil {
				_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, err.Error(), details)
				return fetchedRows, upsertedRows, fmt.Errorf("mark %s sync success on skip: %w", dataset, err)
			}
			if err := a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusOK, fetchedRows, upsertedRows, "", details); err != nil {
				return fetchedRows, upsertedRows, fmt.Errorf("finish %s sync run on skip: %w", dataset, err)
			}
			recordSyncHeartbeat(ctx, moexSyncHeartbeat{
				Secid:   secid,
				Dataset: dataset,
				Mode:    mode,
				Stage:   "dataset_skipped",
				From:    fromDate.Format("2006-01-02"),
				Till:    tillDate.Format("2006-01-02"),
				Message: "already complete coverage",
			})
			return fetchedRows, upsertedRows, nil
		}
	}

	if mode != "full" {
		incomplete, listErr := a.repo.ListIncompleteCoverage(ctx, dataset, secid, fromDate, tillDate)
		if listErr != nil {
			_ = a.repo.MarkSyncError(ctx, dataset, secid, listErr.Error())
			_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, listErr.Error(), details)
			return fetchedRows, upsertedRows, fmt.Errorf("list incomplete %s coverage: %w", dataset, listErr)
		}
		for _, candidate := range incomplete {
			windowFrom, windowTo, ok := clipRange(candidate.FromDate, candidate.ToDate, fromDate, tillDate)
			if !ok {
				continue
			}
			minMutable := immutableBefore.AddDate(0, 0, 1)
			if windowTo.Before(minMutable) {
				continue
			}
			if windowFrom.Before(minMutable) {
				windowFrom = minMutable
			}
			fetched, upserted, windowErr := syncWindow(ctx, secid, windowFrom, windowTo)
			fetchedRows += fetched
			upsertedRows += upserted
			recordSyncHeartbeat(ctx, moexSyncHeartbeat{
				Secid:        secid,
				Dataset:      dataset,
				Mode:         mode,
				Stage:        "repair_window",
				From:         windowFrom.Format("2006-01-02"),
				Till:         windowTo.Format("2006-01-02"),
				FetchedRows:  fetchedRows,
				UpsertedRows: upsertedRows,
			})
			if windowErr != nil {
				_ = a.repo.MarkSyncError(ctx, dataset, secid, windowErr.Error())
				_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, windowErr.Error(), details)
				return fetchedRows, upsertedRows, fmt.Errorf("repair %s range %s..%s: %w", dataset, windowFrom.Format("2006-01-02"), windowTo.Format("2006-01-02"), windowErr)
			}
			repairedRanges++
		}
	}

	mainFetched, mainUpserted, mainErr := syncWindow(ctx, secid, fromDate, tillDate)
	fetchedRows += mainFetched
	upsertedRows += mainUpserted
	recordSyncHeartbeat(ctx, moexSyncHeartbeat{
		Secid:        secid,
		Dataset:      dataset,
		Mode:         mode,
		Stage:        "main_window",
		From:         fromDate.Format("2006-01-02"),
		Till:         tillDate.Format("2006-01-02"),
		FetchedRows:  fetchedRows,
		UpsertedRows: upsertedRows,
	})
	if mainErr != nil {
		_ = a.repo.MarkSyncError(ctx, dataset, secid, mainErr.Error())
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, mainErr.Error(), details)
		return fetchedRows, upsertedRows, mainErr
	}

	if repairedRanges > 0 {
		details = details + fmt.Sprintf(" repaired_ranges=%d", repairedRanges)
	}

	if err := a.repo.MarkSyncSuccessWithState(ctx, dataset, secid, &tillDate, &immutableBefore, &mutableSince); err != nil {
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, err.Error(), details)
		return fetchedRows, upsertedRows, fmt.Errorf("mark %s sync success: %w", dataset, err)
	}
	if err := a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusOK, fetchedRows, upsertedRows, "", details); err != nil {
		return fetchedRows, upsertedRows, fmt.Errorf("finish %s sync run: %w", dataset, err)
	}
	recordSyncHeartbeat(ctx, moexSyncHeartbeat{
		Secid:        secid,
		Dataset:      dataset,
		Mode:         mode,
		Stage:        "dataset_completed",
		From:         fromDate.Format("2006-01-02"),
		Till:         tillDate.Format("2006-01-02"),
		FetchedRows:  fetchedRows,
		UpsertedRows: upsertedRows,
	})

	return fetchedRows, upsertedRows, nil
}

func (a *MoexSyncActivities) resolveEffectiveRange(ctx context.Context, dataset, secid, mode, fromRaw, tillRaw string, defaultLookback, overlapDays int) (time.Time, time.Time, time.Time, time.Time, error) {
	mode = normalizeMode(mode)
	tillDate := todayUTC()
	if strings.TrimSpace(tillRaw) != "" {
		parsed, err := time.Parse("2006-01-02", strings.TrimSpace(tillRaw))
		if err != nil {
			return time.Time{}, time.Time{}, time.Time{}, time.Time{}, fmt.Errorf("invalid till date %q: %w", tillRaw, err)
		}
		tillDate = dateOnlyUTC(parsed)
	}

	mutableSince := tillDate.AddDate(0, 0, -a.mutableDays)
	immutableBefore := mutableSince.AddDate(0, 0, -1)
	if a.immutableBeforeDate != nil {
		immutableBefore = *a.immutableBeforeDate
	}

	var fromDate time.Time
	fromDateOverride, err := parseOptionalDateOnly(fromRaw)
	if err != nil {
		return time.Time{}, time.Time{}, time.Time{}, time.Time{}, err
	}

	if mode == "full" {
		fromDate = mutableSince
		if fromDateOverride != nil {
			fromDate = *fromDateOverride
		}
	} else {
		// Regular mode should be incremental: only mutable horizon by default,
		// and if we have a sync watermark, continue from checked_through-overlap.
		fromDate = immutableBefore.AddDate(0, 0, 1)
		defaultFrom := tillDate.AddDate(0, 0, -defaultLookback)
		if defaultFrom.After(fromDate) {
			fromDate = defaultFrom
		}
		if state, stateErr := a.repo.GetSyncState(ctx, dataset, secid); stateErr != nil {
			return time.Time{}, time.Time{}, time.Time{}, time.Time{}, stateErr
		} else if state != nil && state.CheckedThroughDate != nil {
			candidate := dateOnlyUTC(*state.CheckedThroughDate).AddDate(0, 0, -overlapDays)
			if candidate.After(fromDate) {
				fromDate = candidate
			}
		}

		minMutable := immutableBefore.AddDate(0, 0, 1)
		if fromDate.Before(minMutable) {
			fromDate = minMutable
		}
		if fromDateOverride != nil && fromDateOverride.After(fromDate) {
			fromDate = *fromDateOverride
		}
	}

	if fromDate.After(tillDate) {
		fromDate = tillDate
	}
	return fromDate, tillDate, mutableSince, immutableBefore, nil
}

func (a *MoexSyncActivities) syncHistoryWindow(ctx context.Context, secid string, fromDate, tillDate time.Time) (int, int, error) {
	points, err := a.moexService.GetIndexHistory(ctx, secid, fromDate.Format("2006-01-02"), tillDate.Format("2006-01-02"), 1)
	if err != nil {
		_ = a.repo.UpsertCoverage(ctx, "history", secid, fromDate, tillDate, false)
		return 0, 0, fmt.Errorf("fetch history from moex: %w", err)
	}

	fetchedRows := len(points)
	upsertedRows, err := a.repo.UpsertHistoryPoints(ctx, secid, points)
	if err != nil {
		_ = a.repo.UpsertCoverage(ctx, "history", secid, fromDate, tillDate, false)
		return fetchedRows, upsertedRows, fmt.Errorf("upsert history points: %w", err)
	}
	if err := a.repo.UpsertCoverage(ctx, "history", secid, fromDate, tillDate, true); err != nil {
		return fetchedRows, upsertedRows, fmt.Errorf("upsert history coverage: %w", err)
	}
	return fetchedRows, upsertedRows, nil
}

func (a *MoexSyncActivities) syncCompositionWindow(ctx context.Context, secid string, fromDate, tillDate time.Time) (int, int, error) {
	return a.syncCompositionWindowByTicker(ctx, secid, fromDate, tillDate)
}

func (a *MoexSyncActivities) syncCompositionWindowByTicker(ctx context.Context, secid string, fromDate, tillDate time.Time) (int, int, error) {
	tickers, err := a.moexService.ListIndexCompositionTickers(ctx, secid, "")
	if err != nil {
		_ = a.repo.UpsertCoverage(ctx, "composition", secid, fromDate, tillDate, false)
		return 0, 0, fmt.Errorf("list composition tickers: %w", err)
	}

	fromStr := fromDate.Format("2006-01-02")
	tillStr := tillDate.Format("2006-01-02")
	fetchedRows := 0
	upsertedRows := 0

	for _, tickerWindow := range tickers {
		ticker := strings.TrimSpace(tickerWindow.Ticker)
		if ticker == "" {
			continue
		}

		tickerFrom := fromStr
		tickerTill := tillStr
		candidateFrom := strings.TrimSpace(tickerWindow.From)
		if candidateFrom != "" && candidateFrom > tickerFrom {
			tickerFrom = candidateFrom
		}
		candidateTill := strings.TrimSpace(tickerWindow.Till)
		if candidateTill != "" && candidateTill < tickerTill {
			tickerTill = candidateTill
		}
		if tickerFrom > tickerTill {
			continue
		}

		rows, fetchErr := a.moexService.GetIndexTickerCompositionHistory(ctx, secid, ticker, tickerFrom, tickerTill, "en")
		if fetchErr != nil {
			_ = a.repo.UpsertCoverage(ctx, "composition", secid, fromDate, tillDate, false)
			return fetchedRows, upsertedRows, fmt.Errorf("fetch composition ticker=%s range=%s..%s: %w", ticker, tickerFrom, tickerTill, fetchErr)
		}
		fetchedRows += len(rows)
		if len(rows) == 0 {
			continue
		}

		upserted, upsertErr := a.repo.UpsertCompositionEntries(ctx, secid, normalizeCompositionRows(secid, rows))
		if upsertErr != nil {
			_ = a.repo.UpsertCoverage(ctx, "composition", secid, fromDate, tillDate, false)
			return fetchedRows, upsertedRows, fmt.Errorf("upsert composition ticker=%s range=%s..%s: %w", ticker, tickerFrom, tickerTill, upsertErr)
		}
		upsertedRows += upserted
		recordSyncHeartbeat(ctx, moexSyncHeartbeat{
			Secid:        secid,
			Dataset:      "composition",
			Stage:        "ticker_processed",
			From:         tickerFrom,
			Till:         tickerTill,
			FetchedRows:  fetchedRows,
			UpsertedRows: upsertedRows,
			Message:      ticker,
		})
	}

	if err := a.repo.UpsertCoverage(ctx, "composition", secid, fromDate, tillDate, true); err != nil {
		return fetchedRows, upsertedRows, fmt.Errorf("upsert composition coverage: %w", err)
	}
	return fetchedRows, upsertedRows, nil
}

func recordSyncHeartbeat(ctx context.Context, heartbeat moexSyncHeartbeat) {
	activity.RecordHeartbeat(ctx, heartbeat)
}

func normalizeCompositionRows(indexID string, rows []models.MoexIndexCompositionEntry) []models.MoexIndexCompositionEntry {
	normalized := make([]models.MoexIndexCompositionEntry, 0, len(rows))
	for _, row := range rows {
		row.IndexID = indexID
		normalized = append(normalized, row)
	}
	return normalized
}

func parseOptionalDateOnly(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, fmt.Errorf("invalid date %q: %w", value, err)
	}
	normalized := dateOnlyUTC(parsed)
	return &normalized, nil
}

func normalizeMode(mode string) string {
	mode = strings.TrimSpace(strings.ToLower(mode))
	if mode == "full" {
		return "full"
	}
	return "regular"
}

func todayUTC() time.Time {
	return dateOnlyUTC(time.Now())
}

func dateOnlyUTC(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func clipRange(fromDate, toDate, minDate, maxDate time.Time) (time.Time, time.Time, bool) {
	fromDate = dateOnlyUTC(fromDate)
	toDate = dateOnlyUTC(toDate)
	minDate = dateOnlyUTC(minDate)
	maxDate = dateOnlyUTC(maxDate)
	if fromDate.After(toDate) {
		fromDate, toDate = toDate, fromDate
	}
	if fromDate.Before(minDate) {
		fromDate = minDate
	}
	if toDate.After(maxDate) {
		toDate = maxDate
	}
	if fromDate.After(toDate) {
		return time.Time{}, time.Time{}, false
	}
	return fromDate, toDate, true
}
