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

	MetaRefreshActivityName = "moex.meta_refresh_activity"
	DailySyncActivityName   = "moex.daily_sync_activity"
)

type MetaRefreshParams struct {
	Mode                   string `json:"mode"`
	EnableSearchAttributes bool   `json:"enableSearchAttributes,omitempty"`
}

type DailySyncParams struct {
	Mode                   string `json:"mode"`
	From                   string `json:"from,omitempty"`
	Till                   string `json:"till,omitempty"`
	EnableSearchAttributes bool   `json:"enableSearchAttributes,omitempty"`
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
	if params.EnableSearchAttributes {
		upsertMoexSearchAttributes(ctx, "daily", "", params.Mode)
	}

	ctx = workflow.WithActivityOptions(ctx, defaultActivityOptions(6*time.Hour))

	if err := workflow.ExecuteActivity(ctx, MetaRefreshActivityName, params.Mode).Get(ctx, nil); err != nil {
		return err
	}

	return workflow.ExecuteActivity(ctx, DailySyncActivityName, params).Get(ctx, nil)
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
