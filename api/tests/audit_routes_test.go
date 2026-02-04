package tests

import (
	"net/http"
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
	adminID := userIDByUsername(t, ts, "admin_audit")
	adminCookie := login(t, ts.router, "admin_audit", "password123")

	entityID := 42
	logID := insertAuditLog(t, ts, adminID, "user_created", "user", &entityID, "{\"username\":\"audit_user\"}", time.Now().UTC())
	_ = insertAuditLog(t, ts, adminID, "user_deleted", "user", &entityID, "{}", time.Now().UTC().Add(-time.Minute))

	t.Run("ListAuditLogs", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs", nil, adminCookie)
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
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs/actions", nil, adminCookie)
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
		resp := doRequest(t, ts.router, http.MethodGet, "/api/audit-logs/"+itoa(logID), nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("get audit log status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var logResp auditLogResponse
		decodeJSON(t, resp, &logResp)
		if logResp.ID != logID {
			t.Fatalf("expected audit log id %d, got %d", logID, logResp.ID)
		}
		if logResp.Action != "user_created" {
			t.Fatalf("expected action user_created, got %q", logResp.Action)
		}
		if logResp.PerformedBy == nil || logResp.PerformedBy.Username != "admin_audit" {
			t.Fatalf("expected performed_by to be populated")
		}
	})
}
