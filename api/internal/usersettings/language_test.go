package usersettings

import "testing"

func TestNormalizeLanguage(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "empty defaults to en", in: "", want: "en"},
		{name: "en", in: "en", want: "en"},
		{name: "en-us", in: "en-US", want: "en"},
		{name: "unsupported defaults to en", in: "ru", want: "en"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeLanguage(tt.in)
			if got != tt.want {
				t.Fatalf("NormalizeLanguage(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestNormalizePatchValues(t *testing.T) {
	in := map[string]string{
		"one":           "1",
		SettingLanguage: "ru",
	}
	got := NormalizePatchValues(in)
	if got[SettingLanguage] != "en" {
		t.Fatalf("expected normalized language en, got %q", got[SettingLanguage])
	}
	if got["one"] != "1" {
		t.Fatalf("expected key one to remain unchanged")
	}
	if in[SettingLanguage] != "ru" {
		t.Fatalf("expected input map to stay unchanged")
	}
}
