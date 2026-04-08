package workflows

import (
	"fmt"
	"strings"
	"time"

	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

const (
	MetaRefreshWorkflowName = "moex.meta_refresh"
	DailySyncWorkflowName   = "moex.daily_sync"

	MetaRefreshActivityName     = "moex.meta_refresh_activity"
	DailySyncActivityName       = "moex.daily_sync_activity"
	ListIndexSecidsActivityName = "moex.list_index_secids_activity"
	SyncIndexActivityName       = "moex.sync_index_activity"

	dailySyncPerIndexChangeID = "moex-daily-sync-per-index-v1"

	defaultFullSyncParallelism    = 4
	defaultRegularSyncParallelism = 1
	defaultFullSyncChunkMonths    = 6
)

type MetaRefreshParams struct {
	Mode                   string `json:"mode"`
	EnableSearchAttributes bool   `json:"enableSearchAttributes,omitempty"`
}

type DailySyncParams struct {
	Mode                   string   `json:"mode"`
	From                   string   `json:"from,omitempty"`
	Till                   string   `json:"till,omitempty"`
	ChunkMonths            int      `json:"chunkMonths,omitempty"`
	ChunkCursorTill        string   `json:"chunkCursorTill,omitempty"`
	Parallelism            int      `json:"parallelism,omitempty"`
	RetrySecids            []string `json:"retrySecids,omitempty"`
	RetryPass              int      `json:"retryPass,omitempty"`
	EnableSearchAttributes bool     `json:"enableSearchAttributes,omitempty"`
}

type SyncIndexParams struct {
	Mode  string `json:"mode"`
	From  string `json:"from,omitempty"`
	Till  string `json:"till,omitempty"`
	Secid string `json:"secid"`
	Index int    `json:"index"`
	Total int    `json:"total"`
}

type IndexSyncResult struct {
	Secid                   string `json:"secid"`
	HistoryFetchedRows      int    `json:"historyFetchedRows"`
	HistoryUpsertedRows     int    `json:"historyUpsertedRows"`
	CompositionFetchedRows  int    `json:"compositionFetchedRows"`
	CompositionUpsertedRows int    `json:"compositionUpsertedRows"`
}

func MetaRefreshWorkflow(ctx workflow.Context, params MetaRefreshParams) error {
	params.Mode = normalizeMode(params.Mode)
	if params.EnableSearchAttributes {
		upsertMoexSearchAttributes(ctx, "meta", "", params.Mode)
	}
	ctx = workflow.WithActivityOptions(ctx, defaultActivityOptions(5*time.Minute))
	return workflow.ExecuteActivity(ctx, MetaRefreshActivityName, params.Mode).Get(ctx, nil)
}

func DailySyncWorkflow(ctx workflow.Context, params DailySyncParams) error {
	params.Mode = normalizeMode(params.Mode)
	logger := workflow.GetLogger(ctx)
	retryPass := params.RetryPass
	if retryPass < 1 {
		retryPass = 1
	}
	if params.EnableSearchAttributes {
		upsertMoexSearchAttributes(ctx, "daily", "", params.Mode)
		upsertMoexProgressSearchAttributes(ctx, 0, 0, "", "starting")
	}

	effectiveFrom := params.From
	effectiveTill := params.Till
	chunkPlan, chunkErr := resolveFullModeChunkPlan(params, workflow.Now(ctx))
	if chunkErr != nil {
		return chunkErr
	}
	if chunkPlan.Enabled {
		params.From = chunkPlan.GlobalFrom
		params.Till = chunkPlan.GlobalTill
		params.ChunkMonths = chunkPlan.ChunkMonths
		params.ChunkCursorTill = chunkPlan.CursorTill
		effectiveFrom = chunkPlan.CurrentFrom
		effectiveTill = chunkPlan.CurrentTill
		logger.Info(
			"MOEX full sync chunk selected",
			"chunkMonths", chunkPlan.ChunkMonths,
			"chunkFrom", chunkPlan.CurrentFrom,
			"chunkTill", chunkPlan.CurrentTill,
			"goalFrom", chunkPlan.GlobalFrom,
			"goalTill", chunkPlan.GlobalTill,
			"hasMoreChunks", chunkPlan.HasMore,
		)
	}

	metaCtx := workflow.WithActivityOptions(ctx, defaultActivityOptions(5*time.Minute))
	if err := workflow.ExecuteActivity(metaCtx, MetaRefreshActivityName, params.Mode).Get(metaCtx, nil); err != nil {
		return err
	}

	version := workflow.GetVersion(ctx, dailySyncPerIndexChangeID, workflow.DefaultVersion, 1)
	if version == workflow.DefaultVersion {
		legacyCtx := workflow.WithActivityOptions(ctx, defaultActivityOptions(6*time.Hour))
		return workflow.ExecuteActivity(legacyCtx, DailySyncActivityName, params).Get(legacyCtx, nil)
	}

	listCtx := workflow.WithActivityOptions(ctx, defaultActivityOptions(2*time.Minute))
	var secids []string
	if err := workflow.ExecuteActivity(listCtx, ListIndexSecidsActivityName).Get(listCtx, &secids); err != nil {
		return err
	}

	indexes := make([]string, 0, len(secids))
	for _, secid := range secids {
		if secid == "" {
			continue
		}
		indexes = append(indexes, secid)
	}
	indexes = resolveRetryIndexes(indexes, params.RetrySecids)

	totalIndexes := len(indexes)
	parallelism := resolveSyncParallelism(params.Mode, params.Parallelism, totalIndexes)
	if params.EnableSearchAttributes {
		upsertMoexProgressSearchAttributes(ctx, 0, totalIndexes, "", "running")
	}

	syncCtx := workflow.WithActivityOptions(ctx, defaultActivityOptions(6*time.Hour))
	totalFetchedRows := 0
	totalUpsertedRows := 0

	completed := 0
	failed := 0
	failedIndexes := make([]string, 0)
	nextIndex := 0
	inFlight := 0
	selector := workflow.NewSelector(syncCtx)
	logger.Info(
		"MOEX daily sync pass started",
		"mode", params.Mode,
		"retryPass", retryPass,
		"from", effectiveFrom,
		"till", effectiveTill,
		"indexes", totalIndexes,
		"parallelism", parallelism,
	)

	scheduleIndex := func(i int) {
		secid := indexes[i]
		processed := completed + failed
		if params.EnableSearchAttributes {
			upsertMoexSearchAttributes(ctx, "daily", secid, params.Mode)
			upsertMoexProgressSearchAttributes(ctx, processed, totalIndexes, secid, "running")
		}

		future := workflow.ExecuteActivity(syncCtx, SyncIndexActivityName, SyncIndexParams{
			Mode:  params.Mode,
			From:  effectiveFrom,
			Till:  effectiveTill,
			Secid: secid,
			Index: i + 1,
			Total: totalIndexes,
		})
		inFlight++
		selector.AddFuture(future, func(f workflow.Future) {
			inFlight--
			var result IndexSyncResult
			if err := f.Get(syncCtx, &result); err != nil {
				failed++
				failedIndexes = append(failedIndexes, secid)
				processed := completed + failed
				if params.EnableSearchAttributes {
					upsertMoexProgressSearchAttributes(ctx, processed, totalIndexes, secid, "running")
				}
				logger.Error(
					"MOEX index sync failed after retries; skipping index",
					"secid", secid,
					"index", i+1,
					"total", totalIndexes,
					"retryPass", retryPass,
					"processed", processed,
					"completedIndexes", completed,
					"failedIndexes", failed,
					"progressPercent", progressPercent(processed, totalIndexes),
					"error", err,
				)
				return
			}

			completed++
			processed := completed + failed
			totalFetchedRows += result.HistoryFetchedRows + result.CompositionFetchedRows
			totalUpsertedRows += result.HistoryUpsertedRows + result.CompositionUpsertedRows
			if params.EnableSearchAttributes {
				upsertMoexProgressSearchAttributes(ctx, processed, totalIndexes, secid, "running")
			}
			logger.Info(
				"MOEX index sync completed",
				"secid", secid,
				"index", i+1,
				"total", totalIndexes,
				"retryPass", retryPass,
				"processed", processed,
				"completedIndexes", completed,
				"failedIndexes", failed,
				"progressPercent", progressPercent(processed, totalIndexes),
				"historyFetchedRows", result.HistoryFetchedRows,
				"historyUpsertedRows", result.HistoryUpsertedRows,
				"compositionFetchedRows", result.CompositionFetchedRows,
				"compositionUpsertedRows", result.CompositionUpsertedRows,
			)
		})
	}

	for nextIndex < totalIndexes && inFlight < parallelism {
		scheduleIndex(nextIndex)
		nextIndex++
	}

	for completed+failed < totalIndexes {
		selector.Select(syncCtx)
		for nextIndex < totalIndexes && inFlight < parallelism {
			scheduleIndex(nextIndex)
			nextIndex++
		}
	}

	if params.EnableSearchAttributes {
		upsertMoexSearchAttributes(ctx, "daily", "", params.Mode)
		upsertMoexProgressSearchAttributes(ctx, totalIndexes, totalIndexes, "", "completed")
	}
	failedSample := sampleSecids(failedIndexes, 20)

	if failed > 0 && params.Mode == "full" {
		logger.Info(
			"MOEX daily sync pass completed with failed indexes; continuing as new for retry pass",
			"mode", params.Mode,
			"retryPass", retryPass,
			"indexes", totalIndexes,
			"completedIndexes", completed,
			"failedIndexes", failed,
			"parallelism", parallelism,
			"fetchedRows", totalFetchedRows,
			"upsertedRows", totalUpsertedRows,
			"failedSecidsSample", failedSample,
			"failedSecidsOmitted", len(failedIndexes)-len(failedSample),
		)

		nextParams := params
		nextParams.RetrySecids = failedIndexes
		nextParams.RetryPass = retryPass + 1
		return workflow.NewContinueAsNewError(ctx, DailySyncWorkflow, nextParams)
	}

	if chunkPlan.Enabled && chunkPlan.HasMore {
		logger.Info(
			"MOEX daily sync pass completed for chunk; continuing as new for next chunk",
			"mode", params.Mode,
			"chunkMonths", chunkPlan.ChunkMonths,
			"chunkFrom", chunkPlan.CurrentFrom,
			"chunkTill", chunkPlan.CurrentTill,
			"nextChunkCursorTill", chunkPlan.NextCursorTill,
			"goalFrom", chunkPlan.GlobalFrom,
			"goalTill", chunkPlan.GlobalTill,
			"indexes", totalIndexes,
			"completedIndexes", completed,
			"failedIndexes", failed,
			"parallelism", parallelism,
			"fetchedRows", totalFetchedRows,
			"upsertedRows", totalUpsertedRows,
		)

		nextParams := params
		nextParams.RetrySecids = nil
		nextParams.RetryPass = 1
		nextParams.ChunkCursorTill = chunkPlan.NextCursorTill
		return workflow.NewContinueAsNewError(ctx, DailySyncWorkflow, nextParams)
	}

	logger.Info(
		"MOEX daily sync workflow completed",
		"mode", params.Mode,
		"retryPass", retryPass,
		"indexes", totalIndexes,
		"completedIndexes", completed,
		"failedIndexes", failed,
		"parallelism", parallelism,
		"fetchedRows", totalFetchedRows,
		"upsertedRows", totalUpsertedRows,
		"failedSecidsSample", failedSample,
		"failedSecidsOmitted", len(failedIndexes)-len(failedSample),
	)
	return nil
}

type fullModeChunkPlan struct {
	Enabled        bool
	ChunkMonths    int
	GlobalFrom     string
	GlobalTill     string
	CursorTill     string
	CurrentFrom    string
	CurrentTill    string
	HasMore        bool
	NextCursorTill string
}

func resolveFullModeChunkPlan(params DailySyncParams, now time.Time) (fullModeChunkPlan, error) {
	plan := fullModeChunkPlan{}
	if normalizeMode(params.Mode) != "full" {
		return plan, nil
	}

	fromRaw := strings.TrimSpace(params.From)
	if fromRaw == "" {
		return plan, nil
	}

	globalFrom, err := parseDateOnlyUTC(fromRaw)
	if err != nil {
		return plan, fmt.Errorf("invalid full mode from date %q: %w", params.From, err)
	}

	globalTill := dateOnlyUTC(now)
	if strings.TrimSpace(params.Till) != "" {
		parsedTill, parseErr := parseDateOnlyUTC(params.Till)
		if parseErr != nil {
			return plan, fmt.Errorf("invalid full mode till date %q: %w", params.Till, parseErr)
		}
		globalTill = parsedTill
	}
	if globalFrom.After(globalTill) {
		globalFrom = globalTill
	}

	cursorTill := globalTill
	if strings.TrimSpace(params.ChunkCursorTill) != "" {
		parsedCursor, parseErr := parseDateOnlyUTC(params.ChunkCursorTill)
		if parseErr != nil {
			return plan, fmt.Errorf("invalid full mode chunk cursor till date %q: %w", params.ChunkCursorTill, parseErr)
		}
		cursorTill = parsedCursor
	}
	if cursorTill.After(globalTill) {
		cursorTill = globalTill
	}
	if cursorTill.Before(globalFrom) {
		cursorTill = globalFrom
	}

	chunkMonths := params.ChunkMonths
	if chunkMonths <= 0 {
		chunkMonths = defaultFullSyncChunkMonths
	}

	currentFrom := addMonthsClamped(cursorTill, -chunkMonths).AddDate(0, 0, 1)
	if currentFrom.Before(globalFrom) {
		currentFrom = globalFrom
	}

	plan.Enabled = true
	plan.ChunkMonths = chunkMonths
	plan.GlobalFrom = formatDateOnlyUTC(globalFrom)
	plan.GlobalTill = formatDateOnlyUTC(globalTill)
	plan.CursorTill = formatDateOnlyUTC(cursorTill)
	plan.CurrentFrom = formatDateOnlyUTC(currentFrom)
	plan.CurrentTill = formatDateOnlyUTC(cursorTill)
	plan.HasMore = currentFrom.After(globalFrom)
	if plan.HasMore {
		plan.NextCursorTill = formatDateOnlyUTC(currentFrom.AddDate(0, 0, -1))
	}

	return plan, nil
}

func defaultActivityOptions(timeout time.Duration) workflow.ActivityOptions {
	return workflow.ActivityOptions{
		StartToCloseTimeout: timeout,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    2 * time.Second,
			BackoffCoefficient: 2.0,
			MaximumInterval:    30 * time.Second,
			MaximumAttempts:    5,
		},
	}
}

func normalizeMode(mode string) string {
	mode = strings.TrimSpace(strings.ToLower(mode))
	if mode == "full" {
		return "full"
	}
	return "regular"
}

func resolveSyncParallelism(mode string, requested, total int) int {
	parallelism := requested
	if parallelism <= 0 {
		if normalizeMode(mode) == "full" {
			parallelism = defaultFullSyncParallelism
		} else {
			parallelism = defaultRegularSyncParallelism
		}
	}
	if parallelism < 1 {
		parallelism = 1
	}
	if total > 0 && parallelism > total {
		return total
	}
	return parallelism
}

func resolveRetryIndexes(allIndexes, retrySecids []string) []string {
	if len(retrySecids) == 0 {
		return allIndexes
	}

	retrySet := make(map[string]struct{}, len(retrySecids))
	for _, secid := range retrySecids {
		if secid == "" {
			continue
		}
		retrySet[secid] = struct{}{}
	}
	if len(retrySet) == 0 {
		return []string{}
	}

	filtered := make([]string, 0, len(retrySet))
	for _, secid := range allIndexes {
		if _, ok := retrySet[secid]; ok {
			filtered = append(filtered, secid)
		}
	}
	return filtered
}

func sampleSecids(secids []string, max int) []string {
	if max <= 0 || len(secids) == 0 {
		return []string{}
	}
	if len(secids) <= max {
		copied := make([]string, len(secids))
		copy(copied, secids)
		return copied
	}
	copied := make([]string, max)
	copy(copied, secids[:max])
	return copied
}

func progressPercent(processed, total int) float64 {
	if total <= 0 {
		return 100
	}
	return (float64(processed) * 100.0) / float64(total)
}

func parseDateOnlyUTC(value string) (time.Time, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, err
	}
	return dateOnlyUTC(parsed), nil
}

func formatDateOnlyUTC(value time.Time) string {
	return dateOnlyUTC(value).Format("2006-01-02")
}

func dateOnlyUTC(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func addMonthsClamped(value time.Time, months int) time.Time {
	value = dateOnlyUTC(value)
	firstOfMonth := time.Date(value.Year(), value.Month(), 1, 0, 0, 0, 0, time.UTC)
	shiftedFirst := firstOfMonth.AddDate(0, months, 0)
	lastDay := time.Date(shiftedFirst.Year(), shiftedFirst.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
	day := value.Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(shiftedFirst.Year(), shiftedFirst.Month(), day, 0, 0, 0, 0, time.UTC)
}

func upsertMoexSearchAttributes(ctx workflow.Context, dataset, secid, mode string) {
	attrs := map[string]interface{}{}
	if strings.TrimSpace(dataset) != "" {
		attrs["MoexDataset"] = strings.TrimSpace(dataset)
	}
	if secid != "" {
		attrs["MoexSecid"] = secid
	}
	if strings.TrimSpace(mode) != "" {
		attrs["MoexMode"] = strings.TrimSpace(mode)
	}
	if len(attrs) == 0 {
		return
	}
	if err := workflow.UpsertSearchAttributes(ctx, attrs); err != nil {
		workflow.GetLogger(ctx).Warn("failed to upsert MOEX search attributes", "error", err)
	}
}

func upsertMoexProgressSearchAttributes(ctx workflow.Context, processed, total int, secid, state string) {
	attrs := map[string]interface{}{}
	attrs["MoexProcessed"] = int64(processed)
	attrs["MoexTotal"] = int64(total)
	attrs["MoexProgress"] = strings.TrimSpace(state)
	if secid != "" {
		attrs["MoexSecid"] = secid
	}
	if err := workflow.UpsertSearchAttributes(ctx, attrs); err != nil {
		workflow.GetLogger(ctx).Warn("failed to upsert MOEX progress search attributes", "error", err)
	}
}
