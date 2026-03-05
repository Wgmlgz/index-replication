package tests

import (
	"net/http"
	"testing"
)

type portfolioProfileResponse struct {
	ID           int                                 `json:"id"`
	Provider     string                              `json:"provider"`
	Name         string                              `json:"name"`
	IsDefault    bool                                `json:"is_default"`
	Replication  *portfolioReplicationConfigResponse `json:"replication"`
	Capabilities struct {
		Actions []struct {
			ID string `json:"id"`
		} `json:"actions"`
	} `json:"capabilities"`
}

type portfolioSummaryResponse struct {
	TotalAmountPortfolio float64                             `json:"total_amount_portfolio"`
	Replication          *portfolioReplicationConfigResponse `json:"replication"`
	Money                []struct {
		Currency  string  `json:"currency"`
		Available float64 `json:"available"`
	} `json:"money"`
	Positions []struct {
		Ticker   string  `json:"ticker"`
		Quantity float64 `json:"quantity"`
	} `json:"positions"`
}

type portfolioOperationsResponse struct {
	Items []struct {
		Type     string `json:"type"`
		Quantity int64  `json:"quantity"`
	} `json:"items"`
}

type portfolioHistoryPointResponse struct {
	TradeDate            string  `json:"trade_date"`
	TotalAmountPortfolio float64 `json:"total_amount_portfolio"`
}

type portfolioCompositionEntryResponse struct {
	Ticker   string  `json:"ticker"`
	Quantity float64 `json:"quantity"`
}

type portfolioReplicationConfigResponse struct {
	IsEnabled      bool                   `json:"is_enabled"`
	BenchmarkSecid *string                `json:"benchmark_secid"`
	ModeKey        string                 `json:"mode_key"`
	ModeParams     map[string]interface{} `json:"mode_params"`
	UpdatedAt      string                 `json:"updated_at"`
}

func createPortfolioProfile(
	t *testing.T,
	ts *testServer,
	cookie *http.Cookie,
	provider string,
	name string,
	config map[string]interface{},
) portfolioProfileResponse {
	t.Helper()

	if config == nil {
		config = map[string]interface{}{}
	}

	resp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios", map[string]interface{}{
		"provider":   provider,
		"name":       name,
		"is_default": false,
		"config":     config,
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

func createMockPortfolioProfile(t *testing.T, ts *testServer, cookie *http.Cookie, name string) portfolioProfileResponse {
	t.Helper()
	return createPortfolioProfile(t, ts, cookie, "mock", name, map[string]interface{}{
		"seed": 123,
	})
}

func createVirtualPortfolioProfile(t *testing.T, ts *testServer, cookie *http.Cookie, name string) portfolioProfileResponse {
	t.Helper()
	return createPortfolioProfile(t, ts, cookie, "virtual", name, nil)
}

func seedMoexIndex(t *testing.T, ts *testServer, secid string) {
	t.Helper()
	result := ts.db.Exec(
		"INSERT INTO moex_indexes (secid, short_name, name, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
		secid,
		secid,
		secid+" index",
	)
	if result.Error != nil {
		t.Fatalf("seed moex index %s: %v", secid, result.Error)
	}
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
		_ = createPortfolioProfile(t, ts, adminCookie, "mock", "Create ok", nil)
		virtualProfile := createPortfolioProfile(t, ts, adminCookie, "virtual", "Virtual create ok", nil)
		if virtualProfile.Provider != "virtual" {
			t.Fatalf("expected virtual provider, got %q", virtualProfile.Provider)
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

	t.Run("ReplicationConfigCRUDAndContracts", func(t *testing.T) {
		profile := createMockPortfolioProfile(t, ts, adminCookie, "Replication profile")
		seedMoexIndex(t, ts, "IMOEX")

		listInitialResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios", nil, adminCookie)
		if listInitialResp.Code != http.StatusOK {
			t.Fatalf("initial list status = %d, body = %s", listInitialResp.Code, listInitialResp.Body.String())
		}
		var initialProfiles []portfolioProfileResponse
		decodeJSON(t, listInitialResp, &initialProfiles)
		foundInitial := false
		for _, item := range initialProfiles {
			if item.ID != profile.ID {
				continue
			}
			foundInitial = true
			if item.Replication != nil {
				t.Fatalf("expected replication=null when absent, got %+v", item.Replication)
			}
			// Regression guard: existing fields should remain populated.
			if item.Provider == "" || item.Name == "" {
				t.Fatalf("expected existing profile fields unchanged, got provider=%q name=%q", item.Provider, item.Name)
			}
			break
		}
		if !foundInitial {
			t.Fatalf("profile not found in list response")
		}

		summaryInitialResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/summary", nil, adminCookie)
		if summaryInitialResp.Code != http.StatusOK {
			t.Fatalf("initial summary status = %d, body = %s", summaryInitialResp.Code, summaryInitialResp.Body.String())
		}
		var summaryInitial portfolioSummaryResponse
		decodeJSON(t, summaryInitialResp, &summaryInitial)
		if summaryInitial.Replication != nil {
			t.Fatalf("expected summary replication=null when absent, got %+v", summaryInitial.Replication)
		}
		if summaryInitial.TotalAmountPortfolio <= 0 {
			t.Fatalf("expected summary total amount to stay populated")
		}

		putPayload := map[string]interface{}{
			"is_enabled":      true,
			"benchmark_secid": "IMOEX",
			"mode_key":        "full",
			"mode_params":     map[string]interface{}{"lot_size": 1},
		}
		putResp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", putPayload, adminCookie)
		if putResp.Code != http.StatusOK {
			t.Fatalf("replication create status = %d, body = %s", putResp.Code, putResp.Body.String())
		}
		var createdConfig portfolioReplicationConfigResponse
		decodeJSON(t, putResp, &createdConfig)
		if !createdConfig.IsEnabled || createdConfig.BenchmarkSecid == nil || *createdConfig.BenchmarkSecid != "IMOEX" {
			t.Fatalf("unexpected created replication config: %+v", createdConfig)
		}
		if createdConfig.UpdatedAt == "" {
			t.Fatalf("expected updated_at to be set")
		}

		updatePayload := map[string]interface{}{
			"is_enabled":      false,
			"benchmark_secid": "IMOEX",
			"mode_key":        "sampled",
			"mode_params":     map[string]interface{}{"top_n": 10},
		}
		updateResp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", updatePayload, adminCookie)
		if updateResp.Code != http.StatusOK {
			t.Fatalf("replication update status = %d, body = %s", updateResp.Code, updateResp.Body.String())
		}
		var updatedConfig portfolioReplicationConfigResponse
		decodeJSON(t, updateResp, &updatedConfig)
		if updatedConfig.ModeKey != "sampled" || updatedConfig.IsEnabled {
			t.Fatalf("unexpected updated config: %+v", updatedConfig)
		}

		idempotentResp1 := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", updatePayload, adminCookie)
		if idempotentResp1.Code != http.StatusOK {
			t.Fatalf("idempotent put #1 status = %d, body = %s", idempotentResp1.Code, idempotentResp1.Body.String())
		}
		idempotentResp2 := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", updatePayload, adminCookie)
		if idempotentResp2.Code != http.StatusOK {
			t.Fatalf("idempotent put #2 status = %d, body = %s", idempotentResp2.Code, idempotentResp2.Body.String())
		}
		var idem1 portfolioReplicationConfigResponse
		var idem2 portfolioReplicationConfigResponse
		decodeJSON(t, idempotentResp1, &idem1)
		decodeJSON(t, idempotentResp2, &idem2)
		if idem1.ModeKey != idem2.ModeKey || idem1.IsEnabled != idem2.IsEnabled {
			t.Fatalf("expected repeated PUT to keep config state stable: %+v vs %+v", idem1, idem2)
		}

		listPopulatedResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios", nil, adminCookie)
		if listPopulatedResp.Code != http.StatusOK {
			t.Fatalf("list populated status = %d, body = %s", listPopulatedResp.Code, listPopulatedResp.Body.String())
		}
		var populatedProfiles []portfolioProfileResponse
		decodeJSON(t, listPopulatedResp, &populatedProfiles)
		foundPopulated := false
		for _, item := range populatedProfiles {
			if item.ID != profile.ID {
				continue
			}
			foundPopulated = true
			if item.Replication == nil {
				t.Fatalf("expected replication config to be populated in profiles list")
			}
			if item.Replication.ModeKey != "sampled" {
				t.Fatalf("unexpected list replication payload: %+v", item.Replication)
			}
			break
		}
		if !foundPopulated {
			t.Fatalf("profile not found in populated list response")
		}

		summaryPopulatedResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/summary", nil, adminCookie)
		if summaryPopulatedResp.Code != http.StatusOK {
			t.Fatalf("summary populated status = %d, body = %s", summaryPopulatedResp.Code, summaryPopulatedResp.Body.String())
		}
		var summaryPopulated portfolioSummaryResponse
		decodeJSON(t, summaryPopulatedResp, &summaryPopulated)
		if summaryPopulated.Replication == nil {
			t.Fatalf("expected summary replication config to be populated")
		}
		if summaryPopulated.Replication.ModeKey != "sampled" {
			t.Fatalf("unexpected summary replication payload: %+v", summaryPopulated.Replication)
		}

		plainTickerResp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", map[string]interface{}{
			"is_enabled":      true,
			"benchmark_secid": "UNKNOWN",
		}, adminCookie)
		if plainTickerResp.Code != http.StatusOK {
			t.Fatalf("expected plain ticker benchmark to be accepted, got %d body=%s", plainTickerResp.Code, plainTickerResp.Body.String())
		}
		var plainTickerConfig portfolioReplicationConfigResponse
		decodeJSON(t, plainTickerResp, &plainTickerConfig)
		if plainTickerConfig.BenchmarkSecid == nil || *plainTickerConfig.BenchmarkSecid != "UNKNOWN" {
			t.Fatalf("expected UNKNOWN benchmark ticker to persist, got %+v", plainTickerConfig)
		}

		deleteResp := doRequest(t, ts.router, http.MethodDelete, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", nil, adminCookie)
		if deleteResp.Code != http.StatusNoContent {
			t.Fatalf("replication delete status = %d, body = %s", deleteResp.Code, deleteResp.Body.String())
		}

		listAfterDeleteResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios", nil, adminCookie)
		if listAfterDeleteResp.Code != http.StatusOK {
			t.Fatalf("list after delete status = %d, body = %s", listAfterDeleteResp.Code, listAfterDeleteResp.Body.String())
		}
		var afterDeleteProfiles []portfolioProfileResponse
		decodeJSON(t, listAfterDeleteResp, &afterDeleteProfiles)
		for _, item := range afterDeleteProfiles {
			if item.ID == profile.ID && item.Replication != nil {
				t.Fatalf("expected replication to be null after delete")
			}
		}

		summaryAfterDeleteResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/summary", nil, adminCookie)
		if summaryAfterDeleteResp.Code != http.StatusOK {
			t.Fatalf("summary after delete status = %d, body = %s", summaryAfterDeleteResp.Code, summaryAfterDeleteResp.Body.String())
		}
		var summaryAfterDelete portfolioSummaryResponse
		decodeJSON(t, summaryAfterDeleteResp, &summaryAfterDelete)
		if summaryAfterDelete.Replication != nil {
			t.Fatalf("expected summary replication to be null after delete")
		}
	})

	t.Run("ReplicationPermissionEnforcement", func(t *testing.T) {
		profile := createMockPortfolioProfile(t, ts, adminCookie, "Forbidden replication")
		seedMoexIndex(t, ts, "MXRW")

		if err := ts.db.Exec(
			"INSERT INTO roles (id, key, name, description) VALUES (?, ?, ?, ?)",
			99,
			"no_portfolio_write",
			"No Portfolio Write",
			"No self update settings permission",
		).Error; err != nil {
			t.Fatalf("insert custom role: %v", err)
		}
		insertUser(t, ts, "portfolio_forbidden_user", "password123", "No Portfolio Write User", 99)
		forbiddenCookie := login(t, ts.router, "portfolio_forbidden_user", "password123")

		forbiddenResp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", map[string]interface{}{
			"is_enabled":      true,
			"benchmark_secid": "MXRW",
		}, forbiddenCookie)
		if forbiddenResp.Code != http.StatusForbidden {
			t.Fatalf("expected forbidden for replication put, got %d", forbiddenResp.Code)
		}

		forbiddenDeleteResp := doRequest(t, ts.router, http.MethodDelete, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", nil, forbiddenCookie)
		if forbiddenDeleteResp.Code != http.StatusForbidden {
			t.Fatalf("expected forbidden for replication delete, got %d", forbiddenDeleteResp.Code)
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

	t.Run("VirtualStatefulFlow", func(t *testing.T) {
		profile := createVirtualPortfolioProfile(t, ts, adminCookie, "Virtual flow")

		depositResp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(profile.ID)+"/actions/deposit_cash", map[string]interface{}{
			"payload": map[string]interface{}{
				"amount":      10000,
				"currency":    "RUB",
				"executed_at": "2026-01-01",
			},
		}, adminCookie)
		if depositResp.Code != http.StatusOK {
			t.Fatalf("deposit action status = %d, body = %s", depositResp.Code, depositResp.Body.String())
		}

		summaryAfterDepositResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/summary", nil, adminCookie)
		if summaryAfterDepositResp.Code != http.StatusOK {
			t.Fatalf("summary after deposit status = %d, body = %s", summaryAfterDepositResp.Code, summaryAfterDepositResp.Body.String())
		}
		var summaryAfterDeposit portfolioSummaryResponse
		decodeJSON(t, summaryAfterDepositResp, &summaryAfterDeposit)
		if len(summaryAfterDeposit.Money) == 0 || summaryAfterDeposit.Money[0].Available != 10000 {
			t.Fatalf("expected RUB cash 10000 after deposit, got %+v", summaryAfterDeposit.Money)
		}

		buyResp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(profile.ID)+"/actions/buy", map[string]interface{}{
			"payload": map[string]interface{}{
				"ticker":   "SBER",
				"quantity": 10,
				"price":    100,
				"currency": "RUB",
				"date":     "2026-01-02",
			},
		}, adminCookie)
		if buyResp.Code != http.StatusOK {
			t.Fatalf("buy action status = %d, body = %s", buyResp.Code, buyResp.Body.String())
		}

		summaryAfterBuyResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/summary", nil, adminCookie)
		if summaryAfterBuyResp.Code != http.StatusOK {
			t.Fatalf("summary after buy status = %d, body = %s", summaryAfterBuyResp.Code, summaryAfterBuyResp.Body.String())
		}
		var summaryAfterBuy portfolioSummaryResponse
		decodeJSON(t, summaryAfterBuyResp, &summaryAfterBuy)
		if len(summaryAfterBuy.Positions) == 0 || summaryAfterBuy.Positions[0].Ticker != "SBER" || summaryAfterBuy.Positions[0].Quantity != 10 {
			t.Fatalf("expected SBER position with qty 10 after buy, got %+v", summaryAfterBuy.Positions)
		}
		if len(summaryAfterBuy.Money) == 0 || summaryAfterBuy.Money[0].Available != 9000 {
			t.Fatalf("expected RUB cash 9000 after buy, got %+v", summaryAfterBuy.Money)
		}

		oversellResp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(profile.ID)+"/actions/sell", map[string]interface{}{
			"payload": map[string]interface{}{
				"ticker":      "SBER",
				"quantity":    11,
				"price":       120,
				"currency":    "RUB",
				"executed_at": "2026-01-03",
			},
		}, adminCookie)
		if oversellResp.Code != http.StatusBadRequest {
			t.Fatalf("expected oversell to be rejected with 400, got %d", oversellResp.Code)
		}

		sellResp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(profile.ID)+"/actions/sell", map[string]interface{}{
			"payload": map[string]interface{}{
				"ticker":      "SBER",
				"quantity":    4,
				"price":       120,
				"currency":    "RUB",
				"executed_at": "2026-01-03",
			},
		}, adminCookie)
		if sellResp.Code != http.StatusOK {
			t.Fatalf("sell action status = %d, body = %s", sellResp.Code, sellResp.Body.String())
		}

		summaryAfterSellResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/summary", nil, adminCookie)
		if summaryAfterSellResp.Code != http.StatusOK {
			t.Fatalf("summary after sell status = %d, body = %s", summaryAfterSellResp.Code, summaryAfterSellResp.Body.String())
		}
		var summaryAfterSell portfolioSummaryResponse
		decodeJSON(t, summaryAfterSellResp, &summaryAfterSell)
		if len(summaryAfterSell.Positions) == 0 || summaryAfterSell.Positions[0].Quantity != 6 {
			t.Fatalf("expected SBER quantity 6 after sell, got %+v", summaryAfterSell.Positions)
		}
		if len(summaryAfterSell.Money) == 0 || summaryAfterSell.Money[0].Available != 9480 {
			t.Fatalf("expected RUB cash 9480 after sell, got %+v", summaryAfterSell.Money)
		}

		negativeDepositResp := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(profile.ID)+"/actions/deposit_cash", map[string]interface{}{
			"payload": map[string]interface{}{
				"amount":   -100,
				"currency": "RUB",
				"date":     "2026-01-04",
			},
		}, adminCookie)
		if negativeDepositResp.Code != http.StatusOK {
			t.Fatalf("negative deposit status = %d, body = %s", negativeDepositResp.Code, negativeDepositResp.Body.String())
		}

		summaryAfterNegativeDepositResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/summary", nil, adminCookie)
		if summaryAfterNegativeDepositResp.Code != http.StatusOK {
			t.Fatalf("summary after negative deposit status = %d, body = %s", summaryAfterNegativeDepositResp.Code, summaryAfterNegativeDepositResp.Body.String())
		}
		var summaryAfterNegativeDeposit portfolioSummaryResponse
		decodeJSON(t, summaryAfterNegativeDepositResp, &summaryAfterNegativeDeposit)
		if len(summaryAfterNegativeDeposit.Money) == 0 || summaryAfterNegativeDeposit.Money[0].Available != 9380 {
			t.Fatalf("expected RUB cash 9380 after negative deposit, got %+v", summaryAfterNegativeDeposit.Money)
		}

		historyResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/history?from=2026-01-01&till=2026-01-03&intervalDays=1", nil, adminCookie)
		if historyResp.Code != http.StatusOK {
			t.Fatalf("history status = %d, body = %s", historyResp.Code, historyResp.Body.String())
		}
		var history []portfolioHistoryPointResponse
		decodeJSON(t, historyResp, &history)
		if len(history) != 3 {
			t.Fatalf("expected 3 history points, got %d", len(history))
		}

		compositionResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/composition?date=2026-01-03", nil, adminCookie)
		if compositionResp.Code != http.StatusOK {
			t.Fatalf("composition status = %d, body = %s", compositionResp.Code, compositionResp.Body.String())
		}
		var composition []portfolioCompositionEntryResponse
		decodeJSON(t, compositionResp, &composition)
		if len(composition) == 0 || composition[0].Ticker != "SBER" || composition[0].Quantity != 6 {
			t.Fatalf("unexpected composition result: %+v", composition)
		}

		seriesResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/composition/series?topCount=5&selectionMode=fixed&from=2026-01-01&till=2026-01-03&intervalDays=1", nil, adminCookie)
		if seriesResp.Code != http.StatusOK {
			t.Fatalf("composition series status = %d, body = %s", seriesResp.Code, seriesResp.Body.String())
		}

		operationsResp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(profile.ID)+"/operations?limit=20", nil, adminCookie)
		if operationsResp.Code != http.StatusOK {
			t.Fatalf("operations status = %d, body = %s", operationsResp.Code, operationsResp.Body.String())
		}
		var operations portfolioOperationsResponse
		decodeJSON(t, operationsResp, &operations)
		if len(operations.Items) < 4 {
			t.Fatalf("expected at least 4 operations, got %d", len(operations.Items))
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
