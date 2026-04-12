package rebalance

import "testing"

func TestParseBusinessDayAdjustmentPolicy(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		want      businessDayAdjustmentPolicy
		shouldErr bool
	}{
		{name: "default empty", input: "", want: businessDayAdjustmentStrict},
		{name: "strict", input: "strict", want: businessDayAdjustmentStrict},
		{name: "following", input: "following", want: businessDayAdjustmentFollowing},
		{name: "preceding", input: "preceding", want: businessDayAdjustmentPreceding},
		{name: "modified following", input: "modified_following", want: businessDayAdjustmentModifiedFollowing},
		{name: "modified preceding", input: "modified_preceding", want: businessDayAdjustmentModifiedPreceding},
		{name: "invalid", input: "unknown", shouldErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseBusinessDayAdjustmentPolicy(tc.input)
			if tc.shouldErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("unexpected value: got %q want %q", got, tc.want)
			}
		})
	}
}
