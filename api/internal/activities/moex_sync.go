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
	moexDefaultMutableDays      = 30
	moexDefaultHistoryLookback  = 120
	moexDefaultCompositionRange = 30
	moexHistoryOverlapDays      = 7
	moexCompositionOverlapDays  = 2
)

type MoexSyncActivities struct {
	moexService         *services.MoexService
	repo                *repository.MoexSyncRepository
	mutableDays         int
	immutableBeforeDate *time.Time
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
		if err := a.syncHistoryRange(ctx, secid, mode, from, till); err != nil {
			return err
		}
		if err := a.syncCompositionRange(ctx, secid, mode, from, till); err != nil {
			return err
		}
		synced++
	}
	log.Printf("[Temporal][MOEX] DailySync finished mode=%s indexes=%d", mode, synced)
	return nil
}

func (a *MoexSyncActivities) syncHistoryRange(ctx context.Context, secid, mode, fromRaw, tillRaw string) error {
	const dataset = "history"

	secid = strings.TrimSpace(secid)
	if secid == "" {
		return fmt.Errorf("empty secid for history sync")
	}

	fromDate, tillDate, mutableSince, immutableBefore, err := a.resolveEffectiveRange(ctx, dataset, secid, mode, fromRaw, tillRaw, moexDefaultHistoryLookback, moexHistoryOverlapDays)
	if err != nil {
		return err
	}

	info := activity.GetInfo(ctx)
	runID := uuid.NewString()
	if err := a.repo.StartSyncRun(ctx, runID, info.WorkflowExecution.ID, info.WorkflowExecution.RunID, dataset, secid); err != nil {
		return fmt.Errorf("start history sync run: %w", err)
	}
	if err := a.repo.MarkSyncRunning(ctx, dataset, secid); err != nil {
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, 0, 0, err.Error(), "mark running failed")
		return err
	}

	fetchedRows := 0
	upsertedRows := 0
	repairedRanges := 0
	details := fmt.Sprintf("mode=%s from=%s till=%s", mode, fromDate.Format("2006-01-02"), tillDate.Format("2006-01-02"))

	if mode != "full" {
		incomplete, listErr := a.repo.ListIncompleteCoverage(ctx, dataset, secid, fromDate, tillDate)
		if listErr != nil {
			_ = a.repo.MarkSyncError(ctx, dataset, secid, listErr.Error())
			_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, listErr.Error(), details)
			return fmt.Errorf("list incomplete history coverage: %w", listErr)
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
			fetched, upserted, windowErr := a.syncHistoryWindow(ctx, secid, windowFrom, windowTo)
			fetchedRows += fetched
			upsertedRows += upserted
			if windowErr != nil {
				_ = a.repo.MarkSyncError(ctx, dataset, secid, windowErr.Error())
				_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, windowErr.Error(), details)
				return fmt.Errorf("repair history range %s..%s: %w", windowFrom.Format("2006-01-02"), windowTo.Format("2006-01-02"), windowErr)
			}
			repairedRanges++
		}
	}

	mainFetched, mainUpserted, mainErr := a.syncHistoryWindow(ctx, secid, fromDate, tillDate)
	fetchedRows += mainFetched
	upsertedRows += mainUpserted
	if mainErr != nil {
		_ = a.repo.MarkSyncError(ctx, dataset, secid, mainErr.Error())
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, mainErr.Error(), details)
		return mainErr
	}

	if repairedRanges > 0 {
		details = details + fmt.Sprintf(" repaired_ranges=%d", repairedRanges)
	}

	if err := a.repo.MarkSyncSuccessWithState(ctx, dataset, secid, &tillDate, &immutableBefore, &mutableSince); err != nil {
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, err.Error(), details)
		return fmt.Errorf("mark history sync success: %w", err)
	}
	if err := a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusOK, fetchedRows, upsertedRows, "", details); err != nil {
		return fmt.Errorf("finish history sync run: %w", err)
	}

	return nil
}

func (a *MoexSyncActivities) syncCompositionRange(ctx context.Context, secid, mode, fromRaw, tillRaw string) error {
	const dataset = "composition"

	secid = strings.TrimSpace(secid)
	if secid == "" {
		return fmt.Errorf("empty secid for composition sync")
	}

	fromDate, tillDate, mutableSince, immutableBefore, err := a.resolveEffectiveRange(ctx, dataset, secid, mode, fromRaw, tillRaw, moexDefaultCompositionRange, moexCompositionOverlapDays)
	if err != nil {
		return err
	}

	info := activity.GetInfo(ctx)
	runID := uuid.NewString()
	if err := a.repo.StartSyncRun(ctx, runID, info.WorkflowExecution.ID, info.WorkflowExecution.RunID, dataset, secid); err != nil {
		return fmt.Errorf("start composition sync run: %w", err)
	}
	if err := a.repo.MarkSyncRunning(ctx, dataset, secid); err != nil {
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, 0, 0, err.Error(), "mark running failed")
		return err
	}

	fetchedRows := 0
	upsertedRows := 0
	repairedRanges := 0
	details := fmt.Sprintf("mode=%s from=%s till=%s", mode, fromDate.Format("2006-01-02"), tillDate.Format("2006-01-02"))

	if mode != "full" {
		incomplete, listErr := a.repo.ListIncompleteCoverage(ctx, dataset, secid, fromDate, tillDate)
		if listErr != nil {
			_ = a.repo.MarkSyncError(ctx, dataset, secid, listErr.Error())
			_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, listErr.Error(), details)
			return fmt.Errorf("list incomplete composition coverage: %w", listErr)
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
			fetched, upserted, windowErr := a.syncCompositionWindow(ctx, secid, windowFrom, windowTo)
			fetchedRows += fetched
			upsertedRows += upserted
			if windowErr != nil {
				_ = a.repo.MarkSyncError(ctx, dataset, secid, windowErr.Error())
				_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, windowErr.Error(), details)
				return fmt.Errorf("repair composition range %s..%s: %w", windowFrom.Format("2006-01-02"), windowTo.Format("2006-01-02"), windowErr)
			}
			repairedRanges++
		}
	}

	mainFetched, mainUpserted, mainErr := a.syncCompositionWindow(ctx, secid, fromDate, tillDate)
	fetchedRows += mainFetched
	upsertedRows += mainUpserted
	if mainErr != nil {
		_ = a.repo.MarkSyncError(ctx, dataset, secid, mainErr.Error())
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, mainErr.Error(), details)
		return mainErr
	}

	if repairedRanges > 0 {
		details = details + fmt.Sprintf(" repaired_ranges=%d", repairedRanges)
	}

	if err := a.repo.MarkSyncSuccessWithState(ctx, dataset, secid, &tillDate, &immutableBefore, &mutableSince); err != nil {
		_ = a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusError, fetchedRows, upsertedRows, err.Error(), details)
		return fmt.Errorf("mark composition sync success: %w", err)
	}
	if err := a.repo.FinishSyncRun(ctx, runID, repository.MoexSyncStatusOK, fetchedRows, upsertedRows, "", details); err != nil {
		return fmt.Errorf("finish composition sync run: %w", err)
	}

	return nil
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
	fetchedRows := 0
	upsertedRows := 0

	for day := fromDate; !day.After(tillDate); day = day.AddDate(0, 0, 1) {
		dateStr := day.Format("2006-01-02")
		rows, err := a.moexService.GetIndexComposition(ctx, secid, dateStr, "en")
		if err != nil {
			_ = a.repo.UpsertCoverage(ctx, "composition", secid, fromDate, tillDate, false)
			return fetchedRows, upsertedRows, fmt.Errorf("fetch composition for %s: %w", dateStr, err)
		}
		fetchedRows += len(rows)
		if len(rows) == 0 {
			continue
		}
		upserted, err := a.repo.UpsertCompositionEntries(ctx, secid, normalizeCompositionRows(secid, rows))
		if err != nil {
			_ = a.repo.UpsertCoverage(ctx, "composition", secid, fromDate, tillDate, false)
			return fetchedRows, upsertedRows, fmt.Errorf("upsert composition for %s: %w", dateStr, err)
		}
		upsertedRows += upserted
	}
	if err := a.repo.UpsertCoverage(ctx, "composition", secid, fromDate, tillDate, true); err != nil {
		return fetchedRows, upsertedRows, fmt.Errorf("upsert composition coverage: %w", err)
	}
	return fetchedRows, upsertedRows, nil
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
