package config

import "testing"

func TestResolveWebAppURL(t *testing.T) {
	t.Run("falls back to PUBLIC_BASE_URL", func(t *testing.T) {
		t.Setenv("PUBLIC_BASE_URL", " https://replicant.amogos.pro/ ")
		t.Setenv("TRAEFIK_PORT", "39999")

		got := resolveWebAppURL()
		want := "https://replicant.amogos.pro"
		if got != want {
			t.Fatalf("resolveWebAppURL() = %q, want %q", got, want)
		}
	})

	t.Run("expands PUBLIC_BASE_URL template from env", func(t *testing.T) {
		t.Setenv("WEB_HOST", "app123.localhost")
		t.Setenv("TRAEFIK_PORT", "31111")
		t.Setenv("PUBLIC_BASE_URL", "http://${WEB_HOST}:${TRAEFIK_PORT}")

		got := resolveWebAppURL()
		want := "http://app123.localhost:31111"
		if got != want {
			t.Fatalf("resolveWebAppURL() = %q, want %q", got, want)
		}
	})

	t.Run("ignores malformed PUBLIC_BASE_URL and falls back to localhost", func(t *testing.T) {
		t.Setenv("TRAEFIK_PORT", "35555")
		t.Setenv("PUBLIC_BASE_URL", "http://${WEB_HOST")

		got := resolveWebAppURL()
		want := "http://localhost:35555"
		if got != want {
			t.Fatalf("resolveWebAppURL() = %q, want %q", got, want)
		}
	})

	t.Run("falls back to localhost with TRAEFIK_PORT", func(t *testing.T) {
		t.Setenv("PUBLIC_BASE_URL", "")
		t.Setenv("TRAEFIK_PORT", "35555")

		got := resolveWebAppURL()
		want := "http://localhost:35555"
		if got != want {
			t.Fatalf("resolveWebAppURL() = %q, want %q", got, want)
		}
	})

	t.Run("uses hardcoded localhost default", func(t *testing.T) {
		t.Setenv("PUBLIC_BASE_URL", "")
		t.Setenv("TRAEFIK_PORT", "")

		got := resolveWebAppURL()
		want := "http://localhost:30000"
		if got != want {
			t.Fatalf("resolveWebAppURL() = %q, want %q", got, want)
		}
	})
}
