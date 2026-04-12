package isdayoff

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestService_GetRange_ParsesDelimitedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/getdata" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		_, _ = w.Write([]byte("0\n8\n1"))
	}))
	defer server.Close()

	service := NewService(server.URL)
	from := time.Date(2026, 4, 13, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 15, 0, 0, 0, 0, time.UTC)

	result, err := service.GetRange(context.Background(), from, to)
	if err != nil {
		t.Fatalf("GetRange returned error: %v", err)
	}
	if result["2026-04-13"].Type != "workday" {
		t.Fatalf("unexpected 2026-04-13 status: %+v", result["2026-04-13"])
	}
	if result["2026-04-14"].Type != "public_holiday" {
		t.Fatalf("unexpected 2026-04-14 status: %+v", result["2026-04-14"])
	}
	if result["2026-04-15"].Type != "non_working_day" {
		t.Fatalf("unexpected 2026-04-15 status: %+v", result["2026-04-15"])
	}
}

func TestService_GetRange_ParsesCompactResponseFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("081"))
	}))
	defer server.Close()

	service := NewService(server.URL)
	from := time.Date(2026, 4, 13, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 15, 0, 0, 0, 0, time.UTC)

	result, err := service.GetRange(context.Background(), from, to)
	if err != nil {
		t.Fatalf("GetRange returned error: %v", err)
	}
	if result["2026-04-14"].Code != "8" {
		t.Fatalf("unexpected 2026-04-14 code: %+v", result["2026-04-14"])
	}
}
