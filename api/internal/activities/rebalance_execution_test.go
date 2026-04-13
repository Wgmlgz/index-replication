package activities

import (
	"testing"

	"server/internal/workflows"
)

func TestConvertShareQuantityToLots(t *testing.T) {
	tests := []struct {
		name          string
		shareQuantity float64
		lotSize       int64
		wantLots      int64
		wantErr       bool
	}{
		{
			name:          "lot one passthrough",
			shareQuantity: 7,
			lotSize:       1,
			wantLots:      7,
			wantErr:       false,
		},
		{
			name:          "divisible by ten",
			shareQuantity: 80,
			lotSize:       10,
			wantLots:      8,
			wantErr:       false,
		},
		{
			name:          "divisible by hundred",
			shareQuantity: 300,
			lotSize:       100,
			wantLots:      3,
			wantErr:       false,
		},
		{
			name:          "non divisible",
			shareQuantity: 85,
			lotSize:       10,
			wantLots:      0,
			wantErr:       true,
		},
		{
			name:          "invalid quantity",
			shareQuantity: 0,
			lotSize:       10,
			wantLots:      0,
			wantErr:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotLots, err := convertShareQuantityToLots(tt.shareQuantity, tt.lotSize)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if gotLots != tt.wantLots {
				t.Fatalf("expected lots %d, got %d", tt.wantLots, gotLots)
			}
		})
	}
}

func TestParseLotSizeMap(t *testing.T) {
	input := map[string]interface{}{
		"instruments": []interface{}{
			map[string]interface{}{
				"ticker":        "AFLT",
				"instrument_id": "uid-aflt",
				"lot_size":      10,
			},
			map[string]interface{}{
				"ticker":        "CBOM",
				"instrument_id": "",
				"lot_size":      100,
			},
			map[string]interface{}{
				"ticker":        "ZERO",
				"instrument_id": "uid-zero",
				"lot_size":      0,
			},
		},
	}

	got := parseLotSizeMap(input)

	if got["uid-aflt"] != 10 {
		t.Fatalf("expected lot size 10 for uid-aflt, got %d", got["uid-aflt"])
	}
	if got["CBOM"] != 100 {
		t.Fatalf("expected lot size 100 for CBOM, got %d", got["CBOM"])
	}
	if _, exists := got["uid-zero"]; exists {
		t.Fatalf("expected zero lot size entry to be omitted")
	}
}

func TestBuildExecutionNotificationSummary(t *testing.T) {
	summary := buildExecutionNotificationSummary(workflows.RebalanceExecutionProgress{
		TotalItems:      7,
		CompletedItems:  4,
		FailedItems:     2,
		UnresolvedItems: 1,
	})

	const want = "total 7, completed 4, failed 2, unresolved 1"
	if summary != want {
		t.Fatalf("unexpected summary, want %q got %q", want, summary)
	}
}
