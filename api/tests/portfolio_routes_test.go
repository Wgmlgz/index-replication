package tests

import (
	"net/http"
	"testing"
)

type portfolioProfileResponse struct {
	ID           int    `json:"id"`
	Provider     string `json:"provider"`
	Name         string `json:"name"`
	IsDefault    bool   `json:"is_default"`
	Capabilities struct {
		Actions []struct {
			ID string `json:"id"`
		} `json:"actions"`
	} `json:"capabilities"`
}

func createMockPortfolioProfile(t *testing.T, ts *testServer, cookie *http.Cookie, name string) portfolioProfileResponse {
	t.Helper()

	resp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios", map[string]interface{}{
		"provider":   "mock",
		"name":       name,
		"is_default": false,
		"config": map[string]interface{}{
			"seed": 123,
		},
	}, cookie)
	if resp.Code != http.StatusCreated {
		t.Fatalf("create profile status = %d, body = %s", resp.Code, resp.Body.String())
	}

	var profile portfolioProfileResponse
	decodeJSON(t, resp, &profile)
	if profile.ID <= 0 {
		t.Fatalf("expected profile id > 0")
	}
	return profile
}

func TestPortfolioRoutes(t *testing.T) {
	ts := newTestServer(t)
	defer ts.cleanup()

	seedAdminUser(t, ts, "admin_portfolio", "password123")
	adminCookie := login(t, ts.router, "admin_portfolio", "password123")
	baseProfile := createMockPortfolioProfile(t, ts, adminCookie, "Base mock")

	t.Run("ListProfiles", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("list profiles status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var profiles []portfolioProfileResponse
		decodeJSON(t, resp, &profiles)
		if len(profiles) == 0 {
			t.Fatalf("expected at least one profile")
		}

		unauthResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios", nil, nil)
		if unauthResp.Code != http.StatusUnauthorized {
			t.Fatalf("expected unauthorized, got %d", unauthResp.Code)
		}
	})

	t.Run("CreateProfile", func(t *testing.T) {
		okResp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios", map[string]interface{}{
			"provider": "mock",
			"name":     "Create ok",
		}, adminCookie)
		if okResp.Code != http.StatusCreated {
			t.Fatalf("create profile status = %d, body = %s", okResp.Code, okResp.Body.String())
		}

		errResp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios", map[string]interface{}{
			"provider": "bad-provider",
			"name":     "Invalid",
		}, adminCookie)
		if errResp.Code != http.StatusBadRequest {
			t.Fatalf("expected bad request for invalid provider, got %d", errResp.Code)
		}
	})

	t.Run("PatchProfile", func(t *testing.T) {
		profile := createMockPortfolioProfile(t, ts, adminCookie, "Patch me")
		resp := doRequest(t, ts.router, http.MethodPatch, "/api/me/portfolios/"+itoa(profile.ID), map[string]interface{}{
			"name":       "Patched name",
			"is_default": true,
		}, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("patch profile status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var patched portfolioProfileResponse
		decodeJSON(t, resp, &patched)
		if patched.Name != "Patched name" {
			t.Fatalf("expected patched name, got %q", patched.Name)
		}

		errResp := doRequest(t, ts.router, http.MethodPatch, "/api/me/portfolios/"+itoa(profile.ID), map[string]interface{}{
			"name": "",
		}, adminCookie)
		if errResp.Code != http.StatusBadRequest {
			t.Fatalf("expected bad request for invalid patch payload, got %d", errResp.Code)
		}
	})

	t.Run("GetSummary", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/summary", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("summary status = %d, body = %s", resp.Code, resp.Body.String())
		}

		errResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/99999/summary", nil, adminCookie)
		if errResp.Code != http.StatusNotFound {
			t.Fatalf("expected not found for missing summary profile, got %d", errResp.Code)
		}
	})

	t.Run("GetHistory", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/history?from=2025-01-01&till=2025-01-31&intervalDays=3", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("history status = %d, body = %s", resp.Code, resp.Body.String())
		}

		errResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/history?from=invalid", nil, adminCookie)
		if errResp.Code != http.StatusBadRequest {
			t.Fatalf("expected bad request for invalid history dates, got %d", errResp.Code)
		}
	})

	t.Run("GetComposition", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/composition", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("composition status = %d, body = %s", resp.Code, resp.Body.String())
		}

		errResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/composition?date=bad-date", nil, adminCookie)
		if errResp.Code != http.StatusBadRequest {
			t.Fatalf("expected bad request for invalid composition date, got %d", errResp.Code)
		}
	})

	t.Run("GetCompositionSeries", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/composition/series?topCount=5&selectionMode=fixed", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("composition series status = %d, body = %s", resp.Code, resp.Body.String())
		}

		errResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/composition/series?topCount=-1", nil, adminCookie)
		if errResp.Code != http.StatusBadRequest {
			t.Fatalf("expected bad request for invalid topCount, got %d", errResp.Code)
		}
	})

	t.Run("GetOperations", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/operations?limit=20", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("operations status = %d, body = %s", resp.Code, resp.Body.String())
		}

		errResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/operations?limit=bad", nil, adminCookie)
		if errResp.Code != http.StatusBadRequest {
			t.Fatalf("expected bad request for invalid operations limit, got %d", errResp.Code)
		}
	})

	t.Run("RunAction", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/actions/refresh", map[string]interface{}{
			"payload": map[string]interface{}{
				"note": "from-test",
			},
		}, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("action status = %d, body = %s", resp.Code, resp.Body.String())
		}

		errResp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(baseProfile.ID)+"/actions/not-available", map[string]interface{}{}, adminCookie)
		if errResp.Code != http.StatusBadRequest {
			t.Fatalf("expected bad request for invalid action, got %d", errResp.Code)
		}
	})

	t.Run("DeleteProfile", func(t *testing.T) {
		profile := createMockPortfolioProfile(t, ts, adminCookie, "Delete me")
		resp := doRequest(t, ts.router, http.MethodDelete, "/api/me/portfolios/"+itoa(profile.ID), nil, adminCookie)
		if resp.Code != http.StatusNoContent {
			t.Fatalf("delete profile status = %d, body = %s", resp.Code, resp.Body.String())
		}

		errResp := doRequest(t, ts.router, http.MethodDelete, "/api/me/portfolios/99999", nil, adminCookie)
		if errResp.Code != http.StatusNotFound {
			t.Fatalf("expected not found for missing profile delete, got %d", errResp.Code)
		}
	})
}
