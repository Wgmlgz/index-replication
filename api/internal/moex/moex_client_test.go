package moex

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

func TestMoexISSClientRetriesOnBadRequest(t *testing.T) {
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
	if got := atomic.LoadInt32(&calls); got != moexRequestMaxAttempts {
		t.Fatalf("expected %d attempts, got %d", moexRequestMaxAttempts, got)
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

func TestMoexISSClientFetchShareSecurityHistory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/history/engines/stock/markets/shares/boards/TQBR/securities/SBER.json" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
  "history": {
    "columns": ["TRADEDATE","CLOSE","OPEN","HIGH","LOW"],
    "data": [["2026-01-02",100.5,99.0,101.0,98.5]]
  },
  "history.cursor": {
    "columns": ["INDEX","TOTAL","PAGESIZE"],
    "data": [[0,1,100]]
  }
}`))
	}))
	defer server.Close()

	client := newMoexISSClient(server.URL, 2*time.Second)
	rows, err := client.FetchShareSecurityHistory(context.Background(), "SBER", "TQBR", "2026-01-01", "2026-01-03")
	if err != nil {
		t.Fatalf("FetchShareSecurityHistory returned error: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected one row, got %d", len(rows))
	}
	if rows[0].TradeDate != "2026-01-02" {
		t.Fatalf("unexpected trade date: %s", rows[0].TradeDate)
	}
	if rows[0].Close == nil || *rows[0].Close != 100.5 {
		t.Fatalf("unexpected close: %+v", rows[0].Close)
	}
}

func TestMoexISSClientFetchEngineSchedule(t *testing.T) {
	var gotFrom string
	var gotTill string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/engines/stock.json" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		gotFrom = r.URL.Query().Get("from")
		gotTill = r.URL.Query().Get("till")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
  "engine": {
    "columns": ["NAME"],
    "data": [["stock"]]
  },
  "timetable": {
    "columns": ["week_day","is_work_day","start_time","stop_time"],
    "data": [
      [1,1,"06:20:00","23:59:59"],
      [7,0,null,null]
    ]
  },
  "dailytable": {
    "columns": ["date","is_work_day","start_time","stop_time"],
    "data": [
      ["2026-04-13",1,"07:00:00","20:00:00"]
    ]
  }
}`))
	}))
	defer server.Close()

	client := newMoexISSClient(server.URL, 2*time.Second)
	from := time.Date(2026, 4, 1, 12, 30, 0, 0, time.FixedZone("+03", 3*3600))
	to := time.Date(2026, 4, 30, 23, 59, 59, 0, time.FixedZone("+03", 3*3600))
	schedule, err := client.FetchEngineSchedule(context.Background(), "stock", "en", &from, &to)
	if err != nil {
		t.Fatalf("FetchEngineSchedule returned error: %v", err)
	}
	if gotFrom != "2026-04-01" {
		t.Fatalf("expected query from=2026-04-01, got %q", gotFrom)
	}
	if gotTill != "2026-04-30" {
		t.Fatalf("expected query till=2026-04-30, got %q", gotTill)
	}
	if schedule.Engine != "stock" {
		t.Fatalf("expected engine stock, got %q", schedule.Engine)
	}
	if len(schedule.Timetable) != 2 {
		t.Fatalf("expected 2 weekly rows, got %d", len(schedule.Timetable))
	}
	if len(schedule.Daily) != 1 {
		t.Fatalf("expected 1 daily row, got %d", len(schedule.Daily))
	}
	if schedule.Daily[0].StartTime == nil || *schedule.Daily[0].StartTime != "07:00:00" {
		t.Fatalf("unexpected daily start time: %+v", schedule.Daily[0].StartTime)
	}
}
