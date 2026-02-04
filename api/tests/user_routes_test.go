package tests

import (
	"net/http"
	"testing"
)

type userResponse struct {
	ID        int    `json:"id"`
	Username  string `json:"username"`
	FullName  string `json:"full_name"`
	RoleID    int    `json:"role_id"`
	IsBlocked bool   `json:"is_blocked"`
}

type userListResponse struct {
	Total    int            `json:"total"`
	Page     int            `json:"page"`
	PageSize int            `json:"page_size"`
	Users    []userResponse `json:"users"`
}

func TestUserRoutes(t *testing.T) {
	ts := newTestServer(t)
	defer ts.cleanup()

	seedAdminUser(t, ts, "admin_test", "password123")

	adminCookie := login(t, ts.router, "admin_test", "password123")

	t.Run("Me", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/me", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("/api/me status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var meResp struct {
			User struct {
				Username string `json:"username"`
			} `json:"user"`
		}
		decodeJSON(t, resp, &meResp)
		if meResp.User.Username != "admin_test" {
			t.Fatalf("expected username admin_test, got %q", meResp.User.Username)
		}
	})

	var operatorID int
	t.Run("CreateUser", func(t *testing.T) {
		body := map[string]interface{}{
			"username":  "operator_test",
			"password":  "password123",
			"full_name": "Operator Test",
			"role_id":   4,
		}
		resp := doRequest(t, ts.router, http.MethodPost, "/api/users", body, adminCookie)
		if resp.Code != http.StatusCreated {
			t.Fatalf("create user status = %d, body = %s", resp.Code, resp.Body.String())
		}

		operatorID = findUserIDByUsername(t, ts.router, adminCookie, "operator_test")
		if operatorID == 0 {
			t.Fatalf("expected operator user id to be set")
		}
	})

	t.Run("ListUsers", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, "/api/users", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("list users status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var listResp userListResponse
		decodeJSON(t, resp, &listResp)
		if listResp.Total == 0 {
			t.Fatalf("expected users in list response")
		}
	})

	t.Run("GetUser", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodGet, pathUser(operatorID), nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("get user status = %d, body = %s", resp.Code, resp.Body.String())
		}

		var userResp userResponse
		decodeJSON(t, resp, &userResp)
		if userResp.Username != "operator_test" {
			t.Fatalf("expected username operator_test, got %q", userResp.Username)
		}
	})

	t.Run("UpdateUser", func(t *testing.T) {
		body := map[string]interface{}{
			"full_name": "Operator Updated",
			"role_id":   5,
			"password":  "newpass123",
		}
		resp := doRequest(t, ts.router, http.MethodPut, pathUser(operatorID), body, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("update user status = %d, body = %s", resp.Code, resp.Body.String())
		}

		updated := doRequest(t, ts.router, http.MethodGet, pathUser(operatorID), nil, adminCookie)
		var userResp userResponse
		decodeJSON(t, updated, &userResp)
		if userResp.RoleID != 5 {
			t.Fatalf("expected role_id 5, got %d", userResp.RoleID)
		}
		if userResp.FullName != "Operator Updated" {
			t.Fatalf("expected full_name updated, got %q", userResp.FullName)
		}
	})

	t.Run("BlockUnblockUser", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodPost, pathUserAction(operatorID, "block"), nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("block user status = %d, body = %s", resp.Code, resp.Body.String())
		}

		blocked := doRequest(t, ts.router, http.MethodGet, pathUser(operatorID), nil, adminCookie)
		var userResp userResponse
		decodeJSON(t, blocked, &userResp)
		if !userResp.IsBlocked {
			t.Fatalf("expected user to be blocked")
		}

		resp = doRequest(t, ts.router, http.MethodPost, pathUserAction(operatorID, "unblock"), nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("unblock user status = %d, body = %s", resp.Code, resp.Body.String())
		}

		unblocked := doRequest(t, ts.router, http.MethodGet, pathUser(operatorID), nil, adminCookie)
		decodeJSON(t, unblocked, &userResp)
		if userResp.IsBlocked {
			t.Fatalf("expected user to be unblocked")
		}
	})

	var admin2ID int
	t.Run("DeleteUser", func(t *testing.T) {
		body := map[string]interface{}{
			"username":  "admin_delete",
			"password":  "password123",
			"full_name": "Admin Delete",
			"role_id":   2,
		}
		resp := doRequest(t, ts.router, http.MethodPost, "/api/users", body, adminCookie)
		if resp.Code != http.StatusCreated {
			t.Fatalf("create admin user status = %d, body = %s", resp.Code, resp.Body.String())
		}

		admin2ID = findUserIDByUsername(t, ts.router, adminCookie, "admin_delete")
		if admin2ID == 0 {
			t.Fatalf("expected admin_delete user id to be set")
		}

		resp = doRequest(t, ts.router, http.MethodPost, pathUserAction(admin2ID, "block"), nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("block admin user status = %d, body = %s", resp.Code, resp.Body.String())
		}

		resp = doRequest(t, ts.router, http.MethodDelete, pathUser(admin2ID), nil, adminCookie)
		if resp.Code != http.StatusNoContent {
			t.Fatalf("delete user status = %d, body = %s", resp.Code, resp.Body.String())
		}

		resp = doRequest(t, ts.router, http.MethodGet, pathUser(admin2ID), nil, adminCookie)
		if resp.Code != http.StatusNotFound {
			t.Fatalf("expected deleted user to be 404, got %d", resp.Code)
		}
	})

	t.Run("ChangePassword", func(t *testing.T) {
		body := map[string]string{
			"old_password": "password123",
			"new_password": "password456",
		}
		resp := doRequest(t, ts.router, http.MethodPut, "/api/me/password", body, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("change password status = %d, body = %s", resp.Code, resp.Body.String())
		}

		resp = doRequest(t, ts.router, http.MethodPost, "/api/login", map[string]interface{}{
			"username": "admin_test",
			"password": "password123",
		}, nil)
		if resp.Code == http.StatusOK {
			t.Fatalf("expected old password to fail")
		}

		resp = doRequest(t, ts.router, http.MethodPost, "/api/login", map[string]interface{}{
			"username": "admin_test",
			"password": "password456",
		}, nil)
		if resp.Code != http.StatusOK {
			t.Fatalf("expected new password to succeed, got %d", resp.Code)
		}
	})

	t.Run("Logout", func(t *testing.T) {
		resp := doRequest(t, ts.router, http.MethodPost, "/api/logout", nil, adminCookie)
		if resp.Code != http.StatusOK {
			t.Fatalf("logout status = %d, body = %s", resp.Code, resp.Body.String())
		}

		resp = doRequest(t, ts.router, http.MethodGet, "/api/me", nil, adminCookie)
		if resp.Code != http.StatusUnauthorized {
			t.Fatalf("expected /api/me unauthorized after logout, got %d", resp.Code)
		}
	})
}
