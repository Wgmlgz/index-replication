package workflows

import (
	"testing"
	"time"
)

func TestResolveFullModeChunkPlanDefaultsToSixMonths(t *testing.T) {
	params := DailySyncParams{
		Mode: "full",
		From: "2020-01-01",
		Till: "2020-12-31",
	}

	plan, err := resolveFullModeChunkPlan(params, time.Date(2026, 3, 5, 11, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !plan.Enabled {
		t.Fatalf("expected plan enabled")
	}
	if plan.ChunkMonths != 6 {
		t.Fatalf("expected chunk months 6, got %d", plan.ChunkMonths)
	}
	if plan.CurrentFrom != "2020-07-01" || plan.CurrentTill != "2020-12-31" {
		t.Fatalf("unexpected current chunk: %s..%s", plan.CurrentFrom, plan.CurrentTill)
	}
	if !plan.HasMore {
		t.Fatalf("expected hasMore=true")
	}
	if plan.NextCursorTill != "2020-06-30" {
		t.Fatalf("expected next cursor till 2020-06-30, got %s", plan.NextCursorTill)
	}
}

func TestResolveFullModeChunkPlanFinalChunk(t *testing.T) {
	params := DailySyncParams{
		Mode:            "full",
		From:            "2020-01-01",
		Till:            "2020-12-31",
		ChunkMonths:     6,
		ChunkCursorTill: "2020-06-30",
	}

	plan, err := resolveFullModeChunkPlan(params, time.Date(2026, 3, 5, 11, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if plan.CurrentFrom != "2020-01-01" || plan.CurrentTill != "2020-06-30" {
		t.Fatalf("unexpected current chunk: %s..%s", plan.CurrentFrom, plan.CurrentTill)
	}
	if plan.HasMore {
		t.Fatalf("expected hasMore=false")
	}
	if plan.NextCursorTill != "" {
		t.Fatalf("expected empty next cursor till, got %s", plan.NextCursorTill)
	}
}

func TestResolveFullModeChunkPlanDisabledWithoutFrom(t *testing.T) {
	plan, err := resolveFullModeChunkPlan(DailySyncParams{Mode: "full"}, time.Date(2026, 3, 5, 11, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if plan.Enabled {
		t.Fatalf("expected plan disabled")
	}
}
