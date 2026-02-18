package workflows

import (
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
)

type MetaRefreshParams struct {
	Mode                   string `json:"mode"`
	EnableSearchAttributes bool   `json:"enableSearchAttributes,omitempty"`
}

type DailySyncParams struct {
	Mode                   string `json:"mode"`
	From                   string `json:"from,omitempty"`
	Till                   string `json:"till,omitempty"`
	Parallelism            int    `json:"parallelism,omitempty"`
	EnableSearchAttributes bool   `json:"enableSearchAttributes,omitempty"`
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
	if params.EnableSearchAttributes {
		upsertMoexSearchAttributes(ctx, "daily", "", params.Mode)
		upsertMoexProgressSearchAttributes(ctx, 0, 0, "", "starting")
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
		trimmed := strings.TrimSpace(secid)
		if trimmed == "" {
			continue
		}
		indexes = append(indexes, trimmed)
	}

	totalIndexes := len(indexes)
	parallelism := resolveSyncParallelism(params.Mode, params.Parallelism, totalIndexes)
	if params.EnableSearchAttributes {
		upsertMoexProgressSearchAttributes(ctx, 0, totalIndexes, "", "running")
	}

	syncCtx := workflow.WithActivityOptions(ctx, defaultActivityOptions(6*time.Hour))
	totalFetchedRows := 0
	totalUpsertedRows := 0

	completed := 0
	nextIndex := 0
	inFlight := 0
	var activityErr error
	selector := workflow.NewSelector(syncCtx)

	scheduleIndex := func(i int) {
		secid := indexes[i]
		if params.EnableSearchAttributes {
			upsertMoexSearchAttributes(ctx, "daily", secid, params.Mode)
			upsertMoexProgressSearchAttributes(ctx, completed, totalIndexes, secid, "running")
		}

		future := workflow.ExecuteActivity(syncCtx, SyncIndexActivityName, SyncIndexParams{
			Mode:  params.Mode,
			From:  params.From,
			Till:  params.Till,
			Secid: secid,
			Index: i + 1,
			Total: totalIndexes,
		})
		inFlight++
		selector.AddFuture(future, func(f workflow.Future) {
			inFlight--
			if activityErr != nil {
				return
			}

			var result IndexSyncResult
			if err := f.Get(syncCtx, &result); err != nil {
				activityErr = err
				return
			}

			completed++
			totalFetchedRows += result.HistoryFetchedRows + result.CompositionFetchedRows
			totalUpsertedRows += result.HistoryUpsertedRows + result.CompositionUpsertedRows
			if params.EnableSearchAttributes {
				upsertMoexProgressSearchAttributes(ctx, completed, totalIndexes, secid, "running")
			}
			logger.Info(
				"MOEX index sync completed",
				"secid", secid,
				"index", i+1,
				"total", totalIndexes,
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

	for completed < totalIndexes {
		selector.Select(syncCtx)
		if activityErr != nil {
			return activityErr
		}
		for nextIndex < totalIndexes && inFlight < parallelism {
			scheduleIndex(nextIndex)
			nextIndex++
		}
	}

	if params.EnableSearchAttributes {
		upsertMoexSearchAttributes(ctx, "daily", "", params.Mode)
		upsertMoexProgressSearchAttributes(ctx, totalIndexes, totalIndexes, "", "completed")
	}
	logger.Info(
		"MOEX daily sync workflow completed",
		"mode", params.Mode,
		"indexes", totalIndexes,
		"parallelism", parallelism,
		"fetchedRows", totalFetchedRows,
		"upsertedRows", totalUpsertedRows,
	)
	return nil
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

func upsertMoexSearchAttributes(ctx workflow.Context, dataset, secid, mode string) {
	attrs := map[string]interface{}{}
	if strings.TrimSpace(dataset) != "" {
		attrs["MoexDataset"] = strings.TrimSpace(dataset)
	}
	if strings.TrimSpace(secid) != "" {
		attrs["MoexSecid"] = strings.TrimSpace(secid)
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
	if strings.TrimSpace(secid) != "" {
		attrs["MoexSecid"] = strings.TrimSpace(secid)
	}
	if err := workflow.UpsertSearchAttributes(ctx, attrs); err != nil {
		workflow.GetLogger(ctx).Warn("failed to upsert MOEX progress search attributes", "error", err)
	}
}
