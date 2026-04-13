package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"server/internal/config"
)

type rebalanceScheduleConfigResponse struct {
	IsEnabled             bool       `json:"is_enabled"`
	DtStart               time.Time  `json:"dtstart"`
	RRule                 string     `json:"rrule"`
	BusinessDayAdjustment string     `json:"business_day_adjustment"`
	NextRunAt             *time.Time `json:"next_run_at"`
	LastRunAt             *time.Time `json:"last_run_at"`
	LastError             *string    `json:"last_error"`
	LastRunID             *int       `json:"last_run_id"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

func TestPortfolioRebalanceScheduleRuntimeStateTransitions(t *testing.T) {
	dayoffServer := newAlwaysWorkdayServer(t)
	defer dayoffServer.Close()

	cfg := &config.Config{
		IsDayOffBaseURL:      dayoffServer.URL,
		MoexScheduleTimezone: "UTC",
	}
	ts := newTestServerWithConfig(t, cfg)
	defer ts.cleanup()

	seedAdminUser(t, ts, "admin_schedule_runtime", "password123")
	adminToken := login(t, ts, "admin_schedule_runtime", "password123")
	profile := createMockPortfolioProfile(t, ts, adminToken, "Schedule runtime profile")
	seedMoexIndex(t, ts, "IMOEX")

	putReplicationEnabled := map[string]interface{}{
		"is_enabled":      true,
		"benchmark_secid": "IMOEX",
		"mode_key":        "full",
		"mode_params":     map[string]interface{}{},
	}
	resp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", putReplicationEnabled, adminToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("enable replication status = %d, body = %s", resp.Code, resp.Body.String())
	}

	now := time.Now().UTC().AddDate(0, 0, 1)
	dtStart := time.Date(now.Year(), now.Month(), now.Day(), 10, 0, 0, 0, time.UTC)
	putScheduleEnabled := map[string]interface{}{
		"is_enabled":              true,
		"dtstart":                 dtStart.Format(time.RFC3339),
		"rrule":                   "FREQ=DAILY;COUNT=30",
		"business_day_adjustment": "strict",
	}
	schedulePutResp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/rebalances/schedule", putScheduleEnabled, adminToken)
	if schedulePutResp.Code != http.StatusOK {
		t.Fatalf("enable schedule status = %d, body = %s", schedulePutResp.Code, schedulePutResp.Body.String())
	}

	current := getScheduleConfig(t, ts, adminToken, profile.ID)
	if current.NextRunAt == nil {
		t.Fatalf("expected next_run_at to be set after enabled schedule upsert")
	}

	lastRunAt := time.Date(2026, 4, 10, 12, 0, 0, 0, time.UTC)
	lastError := "seeded execution failure"
	lastRunID := 99
	if err := ts.db.Exec(
		"UPDATE portfolio_rebalance_schedules SET last_run_at = ?, last_error = ?, last_run_id = ? WHERE portfolio_profile_id = ?",
		lastRunAt,
		lastError,
		lastRunID,
		profile.ID,
	).Error; err != nil {
		t.Fatalf("seed schedule last_* runtime fields: %v", err)
	}

	putReplicationDisabled := map[string]interface{}{
		"is_enabled":      false,
		"benchmark_secid": "IMOEX",
		"mode_key":        "full",
		"mode_params":     map[string]interface{}{},
	}
	replicationDisableResp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", putReplicationDisabled, adminToken)
	if replicationDisableResp.Code != http.StatusOK {
		t.Fatalf("disable replication status = %d, body = %s", replicationDisableResp.Code, replicationDisableResp.Body.String())
	}

	afterDisable := getScheduleConfig(t, ts, adminToken, profile.ID)
	if afterDisable.NextRunAt == nil {
		t.Fatalf("expected next_run_at to stay set after replication disable")
	}
	assertScheduleLastRuntimeFields(t, afterDisable, lastRunAt, lastError, lastRunID)

	replicationEnableResp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", putReplicationEnabled, adminToken)
	if replicationEnableResp.Code != http.StatusOK {
		t.Fatalf("re-enable replication status = %d, body = %s", replicationEnableResp.Code, replicationEnableResp.Body.String())
	}

	afterReEnable := getScheduleConfig(t, ts, adminToken, profile.ID)
	if afterReEnable.NextRunAt == nil {
		t.Fatalf("expected next_run_at to be recomputed after replication re-enable")
	}
	assertScheduleLastRuntimeFields(t, afterReEnable, lastRunAt, lastError, lastRunID)

	replicationDeleteResp := doRequest(t, ts.router, http.MethodDelete, "/api/me/portfolios/"+itoa(profile.ID)+"/replication", nil, adminToken)
	if replicationDeleteResp.Code != http.StatusNoContent {
		t.Fatalf("delete replication status = %d, body = %s", replicationDeleteResp.Code, replicationDeleteResp.Body.String())
	}

	afterDelete := getScheduleConfig(t, ts, adminToken, profile.ID)
	if afterDelete.NextRunAt == nil {
		t.Fatalf("expected next_run_at to stay set after replication delete")
	}
	assertScheduleLastRuntimeFields(t, afterDelete, lastRunAt, lastError, lastRunID)

	putScheduleDisabled := map[string]interface{}{
		"is_enabled":              false,
		"dtstart":                 dtStart.Format(time.RFC3339),
		"rrule":                   "FREQ=DAILY;COUNT=30",
		"business_day_adjustment": "strict",
	}
	scheduleDisableResp := doRequest(t, ts.router, http.MethodPut, "/api/me/portfolios/"+itoa(profile.ID)+"/rebalances/schedule", putScheduleDisabled, adminToken)
	if scheduleDisableResp.Code != http.StatusOK {
		t.Fatalf("disable schedule status = %d, body = %s", scheduleDisableResp.Code, scheduleDisableResp.Body.String())
	}

	afterScheduleDisable := getScheduleConfig(t, ts, adminToken, profile.ID)
	if afterScheduleDisable.NextRunAt != nil {
		t.Fatalf("expected next_run_at=nil after schedule disable, got %v", afterScheduleDisable.NextRunAt)
	}
	assertScheduleLastRuntimeFields(t, afterScheduleDisable, lastRunAt, lastError, lastRunID)
}

func getScheduleConfig(t *testing.T, ts *testServer, bearerToken string, portfolioID int) rebalanceScheduleConfigResponse {
	t.Helper()

	resp := doRequest(t, ts.router, http.MethodGet, "/api/me/portfolios/"+itoa(portfolioID)+"/rebalances/schedule", nil, bearerToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("get schedule status = %d, body = %s", resp.Code, resp.Body.String())
	}

	var parsed rebalanceScheduleConfigResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &parsed); err != nil {
		t.Fatalf("decode schedule response: %v", err)
	}
	return parsed
}

func assertScheduleLastRuntimeFields(
	t *testing.T,
	resp rebalanceScheduleConfigResponse,
	expectedLastRunAt time.Time,
	expectedLastError string,
	expectedLastRunID int,
) {
	t.Helper()

	if resp.LastRunAt == nil || !resp.LastRunAt.Equal(expectedLastRunAt) {
		t.Fatalf("expected last_run_at=%s, got %v", expectedLastRunAt.Format(time.RFC3339), resp.LastRunAt)
	}
	if resp.LastError == nil || *resp.LastError != expectedLastError {
		t.Fatalf("expected last_error=%q, got %v", expectedLastError, resp.LastError)
	}
	if resp.LastRunID == nil || *resp.LastRunID != expectedLastRunID {
		t.Fatalf("expected last_run_id=%d, got %v", expectedLastRunID, resp.LastRunID)
	}
}

func newAlwaysWorkdayServer(t *testing.T) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		date1 := r.URL.Query().Get("date1")
		date2 := r.URL.Query().Get("date2")
		from, err := time.Parse("20060102", date1)
		if err != nil {
			t.Fatalf("invalid date1: %v", err)
		}
		to, err := time.Parse("20060102", date2)
		if err != nil {
			t.Fatalf("invalid date2: %v", err)
		}

		rows := make([]byte, 0)
		for day := from; !day.After(to); day = day.AddDate(0, 0, 1) {
			if len(rows) > 0 {
				rows = append(rows, '\n')
			}
			rows = append(rows, '0')
		}

		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write(rows)
	}))
}
