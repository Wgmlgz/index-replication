package tbank

import "testing"

func TestMaskToken(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		token string
		want  string
	}{
		{
			name:  "empty token",
			token: "   ",
			want:  "",
		},
		{
			name:  "short token fully masked",
			token: "t.PL1234",
			want:  "********",
		},
		{
			name:  "medium token keeps edge chars",
			token: "t.PL12345678",
			want:  "t.PL****5678",
		},
		{
			name:  "long token uses capped mask length",
			token: "t.PL1234567890ABCDEFGHIJET2g",
			want:  "t.PL********ET2g",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := maskToken(tc.token)
			if got != tc.want {
				t.Fatalf("maskToken(%q) = %q, want %q", tc.token, got, tc.want)
			}
		})
	}
}
