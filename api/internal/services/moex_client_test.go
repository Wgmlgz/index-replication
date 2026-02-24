package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

const moexIndexesPayload = `{
  "securities": {
    "columns": ["SECID","SHORTNAME","NAME","CURRENCYID","DECIMALS","BOARDID","CALCMODE","ANNUALHIGH","ANNUALLOW"],
    "data": [["IMOEX","IMOEX","MOEX Russia Index","RUB",2,"TQBR","cap",100.5,99.1]]
  }
}`

func TestMoexISSClientRetriesRetryableStatuses(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt := atomic.AddInt32(&calls, 1)
		if attempt < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":"temporary"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(moexIndexesPayload))
	}))
	defer server.Close()

	client := newMoexISSClient(server.URL, 2*time.Second)
	indexes, err := client.FetchIndexes(context.Background(), "en")
	if err != nil {
		t.Fatalf("FetchIndexes returned error: %v", err)
	}
	if len(indexes) != 1 {
		t.Fatalf("expected 1 index, got %d", len(indexes))
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Fatalf("expected 3 attempts, got %d", got)
	}
}

func TestMoexISSClientRetriesTimeouts(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt := atomic.AddInt32(&calls, 1)
		if attempt < 3 {
			time.Sleep(120 * time.Millisecond)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(moexIndexesPayload))
	}))
	defer server.Close()

	client := newMoexISSClient(server.URL, 40*time.Millisecond)
	indexes, err := client.FetchIndexes(context.Background(), "en")
	if err != nil {
		t.Fatalf("FetchIndexes returned error: %v", err)
	}
	if len(indexes) != 1 {
		t.Fatalf("expected 1 index, got %d", len(indexes))
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Fatalf("expected 3 attempts, got %d", got)
	}
}

func TestMoexISSClientDoesNotRetryOnBadRequest(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"bad request"}`))
	}))
	defer server.Close()

	client := newMoexISSClient(server.URL, 2*time.Second)
	_, err := client.FetchIndexes(context.Background(), "en")
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("expected 1 attempt, got %d", got)
	}
}

func TestMoexISSClientStopsAfterMaxAttempts(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(http.StatusGatewayTimeout)
		_, _ = w.Write([]byte(`{"error":"timeout"}`))
	}))
	defer server.Close()

	client := newMoexISSClient(server.URL, 2*time.Second)
	_, err := client.FetchIndexes(context.Background(), "en")
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if got := atomic.LoadInt32(&calls); got != moexRequestMaxAttempts {
		t.Fatalf("expected %d attempts, got %d", moexRequestMaxAttempts, got)
	}
}

func TestResolveCompositionWeightPrefersWeight(t *testing.T) {
	row := map[string]interface{}{
		"weight":   12.34,
		"w_factor": 0.56,
	}

	weight := resolveCompositionWeight(row)
	if weight == nil {
		t.Fatalf("expected non-nil weight")
	}
	if *weight != 12.34 {
		t.Fatalf("expected 12.34, got %v", *weight)
	}
}

func TestResolveCompositionWeightFallsBackToWi(t *testing.T) {
	row := map[string]interface{}{
		"weight": 0.0,
		"wi":     0.789,
	}

	weight := resolveCompositionWeight(row)
	if weight == nil {
		t.Fatalf("expected non-nil weight")
	}
	if *weight != 0.789 {
		t.Fatalf("expected 0.789, got %v", *weight)
	}
}

func TestResolveCompositionWeightFallsBackToWFactor(t *testing.T) {
	row := map[string]interface{}{
		"weight":   nil,
		"w_factor": "0.1234",
	}

	weight := resolveCompositionWeight(row)
	if weight == nil {
		t.Fatalf("expected non-nil weight")
	}
	if *weight != 0.1234 {
		t.Fatalf("expected 0.1234, got %v", *weight)
	}
}
