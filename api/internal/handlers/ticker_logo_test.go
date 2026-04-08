package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPickTickerISIN(t *testing.T) {
	t.Parallel()

	table := moexSecuritiesTable{
		Columns: []string{"secid", "isin"},
		Data: [][]interface{}{
			{"FIXRUAL", nil},
			{"RUAL", "RU000A1025V3"},
		},
	}

	if got := pickTickerISIN(table, "RUAL"); got != "RU000A1025V3" {
		t.Fatalf("pickTickerISIN() = %q, want %q", got, "RU000A1025V3")
	}
}

func TestPickTickerISINNoMatch(t *testing.T) {
	t.Parallel()

	table := moexSecuritiesTable{
		Columns: []string{"secid", "isin"},
		Data: [][]interface{}{
			{"SBER", "RU0009029540"},
		},
	}

	if got := pickTickerISIN(table, "RUAL"); got != "" {
		t.Fatalf("pickTickerISIN() = %q, want empty", got)
	}
}

func TestLogoExistsHead200(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodHead {
			t.Fatalf("method = %s, want HEAD", r.Method)
		}
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	h := &TickerLogoHandler{
		client: &http.Client{Timeout: 2 * time.Second},
	}

	exists, err := h.logoExists(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("logoExists() error = %v", err)
	}
	if !exists {
		t.Fatal("logoExists() = false, want true")
	}
}

func TestLogoExistsHead403(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	t.Cleanup(srv.Close)

	h := &TickerLogoHandler{
		client: &http.Client{Timeout: 2 * time.Second},
	}

	exists, err := h.logoExists(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("logoExists() error = %v", err)
	}
	if exists {
		t.Fatal("logoExists() = true, want false")
	}
}

func TestLogoExistsHead500ReturnsError(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	t.Cleanup(srv.Close)

	h := &TickerLogoHandler{
		client: &http.Client{Timeout: 2 * time.Second},
	}

	exists, err := h.logoExists(context.Background(), srv.URL)
	if exists {
		t.Fatal("logoExists() = true, want false")
	}
	if err == nil {
		t.Fatal("logoExists() error = nil, want non-nil")
	}
}

func TestLogoExistsHead405FallsBackToGet(t *testing.T) {
	t.Parallel()

	headCalls := 0
	getCalls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodHead:
			headCalls++
			w.WriteHeader(http.StatusMethodNotAllowed)
		case http.MethodGet:
			getCalls++
			if r.Header.Get("Range") != "bytes=0-0" {
				t.Fatalf("Range header = %q, want bytes=0-0", r.Header.Get("Range"))
			}
			w.WriteHeader(http.StatusOK)
		default:
			t.Fatalf("unexpected method %s", r.Method)
		}
	}))
	t.Cleanup(srv.Close)

	h := &TickerLogoHandler{
		client: &http.Client{Timeout: 2 * time.Second},
	}

	exists, err := h.logoExists(context.Background(), srv.URL)
	if err != nil {
		t.Fatalf("logoExists() error = %v", err)
	}
	if !exists {
		t.Fatal("logoExists() = false, want true")
	}
	if headCalls != 1 || getCalls != 1 {
		t.Fatalf("calls: head=%d get=%d, want 1/1", headCalls, getCalls)
	}
}

func TestTickerLogoCandidatesPrimaryOnly(t *testing.T) {
	t.Parallel()

	got := tickerLogoCandidates(" RU000A1025V3 ")
	if len(got) != 1 {
		t.Fatalf("len(candidates) = %d, want 1; got=%v", len(got), got)
	}
	if got[0] != "RU000A1025V3" {
		t.Fatalf("candidates[0] = %q, want %q", got[0], "RU000A1025V3")
	}
}

func TestAppendUniqueTickerLogoKeyDedupAndTrim(t *testing.T) {
	t.Parallel()

	got := appendUniqueTickerLogoKey([]string{"RU000A0JWDN61"}, " ru000a0jwdn61 ")
	if len(got) != 1 {
		t.Fatalf("len(candidates) = %d, want 1; got=%v", len(got), got)
	}
	if got[0] != "RU000A0JWDN61" {
		t.Fatalf("candidates[0] = %q, want %q", got[0], "RU000A0JWDN61")
	}
}

func TestAppendUniqueTickerLogoKeyAppendsNew(t *testing.T) {
	t.Parallel()

	got := appendUniqueTickerLogoKey([]string{"RU000A1025V3"}, "RU000A0JWDN61")
	if len(got) != 2 {
		t.Fatalf("len(candidates) = %d, want 2; got=%v", len(got), got)
	}
	if got[1] != "RU000A0JWDN61" {
		t.Fatalf("candidates[1] = %q, want %q", got[1], "RU000A0JWDN61")
	}
}

func TestPickTbankLogoKeyFromHTML(t *testing.T) {
	t.Parallel()

	html := `... "investBrand":{"RUAL":{"logoName":"RU000A0JWDN61.png","name":"RUSAL"}} ...`
	got := pickTbankLogoKeyFromHTML(html, "RUAL")
	if got != "RU000A0JWDN61" {
		t.Fatalf("pickTbankLogoKeyFromHTML() = %q, want %q", got, "RU000A0JWDN61")
	}
}

func TestPickTbankLogoKeyFromHTMLEmptyWhenTickerMissing(t *testing.T) {
	t.Parallel()

	html := `... "investBrand":{"SBER":{"logoName":"RU0009029540.png"}} ...`
	got := pickTbankLogoKeyFromHTML(html, "RUAL")
	if got != "" {
		t.Fatalf("pickTbankLogoKeyFromHTML() = %q, want empty", got)
	}
}
