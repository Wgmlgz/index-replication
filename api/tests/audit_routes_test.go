package tests

import (
	"net/http"
	"slices"
	"testing"
	"time"
)

type auditLogResponse struct {
	ID          int    `json:"id"`
	Action      string `json:"action"`
	EntityType  string `json:"entity_type"`
	EntityID    *int   `json:"entity_id"`
	Details     string `json:"details"`
	Timestamp   string `json:"timestamp"`
	PerformedBy *struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
		FullName string `json:"full_name"`
	} `json:"performed_by"`
}

type auditLogListResponse struct {
	Total    int                `json:"total"`
	Page     int                `json:"page"`
	PageSize int                `json:"page_size"`
	Logs     []auditLogResponse `json:"logs"`
}

func TestAuditLogRoutes(t *testing.T) {
	ts := newTestServer(t)
	defer ts.cleanup()

	seedAdminUser(t, ts, "admin_audit", "password123")
	insertUser(t, ts, "operator_audit", "password123", "Operator Audit", 4)
	adminID := userIDByUsername(t, ts, "admin_audit")
	operatorID := userIDByUsername(t, ts, "operator_audit")
	adminToken := login(t, ts, "admin_audit", "password123")
	operatorToken := login(t, ts, "operator_audit", "password123")

	entityID := 42
	adminLogID := insertAuditLog(t, ts, adminID, "admin_only_action", "user", &entityID, "{\"username\":\"audit_user\"}", time.Now().UTC())
	_ = insertAuditLog(t, ts, adminID, "user_deleted", "user", &entityID, "{}", time.Now().UTC().Add(-time.Minute))
	operatorLogID := insertAuditLog(t, ts, operatorID, "operator_only_action", "user", &entityID, "{}", time.Now().UTC().Add(-2*time.Minute))

	t.Run("ListAuditLogs", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs", nil, adminToken)
		if resp.Code != http.StatusOK {
			t.Fatalf("list audit logs status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var listResp auditLogListResponse
		decodeJSON(t, resp, &listResp)
		if listResp.Total < 2 {
			t.Fatalf("expected at least 2 audit logs, got %d", listResp.Total)
		}
	})

	t.Run("GetAuditLogActions", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs/actions", nil, adminToken)
		if resp.Code != http.StatusOK {
			t.Fatalf("audit log actions status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var payload struct {
			Actions     []string `json:"actions"`
			EntityTypes []string `json:"entity_types"`
		}
		decodeJSON(t, resp, &payload)
		if len(payload.Actions) == 0 || len(payload.EntityTypes) == 0 {
			t.Fatalf("expected actions and entity_types to be populated")
		}
	})

	t.Run("GetAuditLog", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs/"+itoa(adminLogID), nil, adminToken)
		if resp.Code != http.StatusOK {
			t.Fatalf("get audit log status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var logResp auditLogResponse
		decodeJSON(t, resp, &logResp)
		if logResp.ID != adminLogID {
			t.Fatalf("expected audit log id %d, got %d", adminLogID, logResp.ID)
		}
		if logResp.Action != "admin_only_action" {
			t.Fatalf("expected action admin_only_action, got %q", logResp.Action)
		}
		if logResp.PerformedBy == nil || logResp.PerformedBy.Username != "admin_audit" {
			t.Fatalf("expected performed_by to be populated")
		}
	})

	t.Run("ListAuditLogsScopesToCurrentUser", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs", nil, operatorToken)
		if resp.Code != http.StatusOK {
			t.Fatalf("list audit logs status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var listResp auditLogListResponse
		decodeJSON(t, resp, &listResp)
		if listResp.Total == 0 {
			t.Fatalf("expected scoped logs for current user")
		}
		for _, logResp := range listResp.Logs {
			if logResp.PerformedBy == nil || logResp.PerformedBy.ID != operatorID {
				t.Fatalf("expected only operator logs, got performed_by=%+v", logResp.PerformedBy)
			}
			if logResp.ID == adminLogID {
				t.Fatalf("unexpected admin log in operator response")
			}
		}
	})

	t.Run("ListAuditLogsIgnoresCrossUserPerformedByFilter", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs?performed_by="+itoa(adminID), nil, operatorToken)
		if resp.Code != http.StatusOK {
			t.Fatalf("list audit logs status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var listResp auditLogListResponse
		decodeJSON(t, resp, &listResp)
		if listResp.Total != 0 {
			t.Fatalf("expected zero logs when filtering to another user, got %d", listResp.Total)
		}
	})

	t.Run("GetAuditLogScopesToCurrentUser", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs/"+itoa(adminLogID), nil, operatorToken)
		if resp.Code != http.StatusNotFound {
			t.Fatalf("expected not found for foreign audit log, got %d body=%s", resp.Code, resp.Body.String())
		}

		resp = doRequest(t, ts.router, http.MethodGet, "/api/audit-logs/"+itoa(operatorLogID), nil, operatorToken)
		if resp.Code != http.StatusOK {
			t.Fatalf("expected own audit log to be accessible, got %d body=%s", resp.Code, resp.Body.String())
		}
	})

	t.Run("GetAuditLogActionsScopesToCurrentUser", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs/actions", nil, operatorToken)
		if resp.Code != http.StatusOK {
			t.Fatalf("audit log actions status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var payload struct {
			Actions     []string `json:"actions"`
			EntityTypes []string `json:"entity_types"`
		}
		decodeJSON(t, resp, &payload)
		if !slices.Contains(payload.Actions, "operator_only_action") {
			t.Fatalf("expected scoped operator action in actions payload")
		}
		if slices.Contains(payload.Actions, "admin_only_action") {
			t.Fatalf("did not expect foreign admin action in actions payload")
		}
	})
}
