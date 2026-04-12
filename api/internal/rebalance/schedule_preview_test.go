package rebalance

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/moex"

	"gorm.io/gorm"
)

func TestSchedulePreviewService_PreviewFiltersByMoexTradingWindow(t *testing.T) {
	moexServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/engines/stock.json" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
  "engine": { "columns": ["NAME"], "data": [["stock"]] },
  "timetable": {
    "columns": ["week_day","is_work_day","start_time","stop_time"],
    "data": [[1,1,"00:00:00","23:59:59"]]
  },
  "dailytable": {
    "columns": ["date","is_work_day","start_time","stop_time"],
    "data": [
      ["2018-05-09",0,"10:00:00","18:30:00"],
      ["2026-04-13",1,"10:00:00","12:00:00"]
    ]
  }
}`))
	}))
	defer moexServer.Close()

	service := NewSchedulePreviewService(
		&fakeScheduleProfileRepository{
			profile: &models.PortfolioProfile{ID: 10, UserID: 5},
		},
		moex.NewMoexService(moexServer.URL),
	)
	service.now = func() time.Time {
		return time.Date(2026, 4, 13, 9, 0, 0, 0, time.UTC)
	}

	from := time.Date(2026, 4, 13, 9, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 13, 14, 0, 0, 0, time.UTC)
	resp, err := service.Preview(context.Background(), 5, 10, &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart: from,
		RRule:   "FREQ=HOURLY;COUNT=6",
		From:    &from,
		To:      &to,
	})
	if err != nil {
		t.Fatalf("Preview returned error: %v", err)
	}
	if len(resp.Events) != 3 {
		t.Fatalf("expected 3 filtered events, got %d", len(resp.Events))
	}
	if resp.Moex.Engine != "stock" {
		t.Fatalf("expected moex engine stock, got %q", resp.Moex.Engine)
	}
	if len(resp.Moex.Calendar) != 1 {
		t.Fatalf("expected 1 moex calendar row, got %d", len(resp.Moex.Calendar))
	}
	if resp.Moex.Calendar[0].Date != "2026-04-13" {
		t.Fatalf("expected moex calendar date 2026-04-13, got %s", resp.Moex.Calendar[0].Date)
	}
	if resp.Moex.Calendar[0].Source != "dailytable" {
		t.Fatalf("expected moex calendar source dailytable, got %s", resp.Moex.Calendar[0].Source)
	}
	expected := []string{
		"2026-04-13T10:00:00Z",
		"2026-04-13T11:00:00Z",
		"2026-04-13T12:00:00Z",
	}
	for i, event := range resp.Events {
		if got := event.Format(time.RFC3339); got != expected[i] {
			t.Fatalf("unexpected event at index %d: got %s want %s", i, got, expected[i])
		}
	}
}

func TestSchedulePreviewService_PreviewValidation(t *testing.T) {
	service := NewSchedulePreviewService(
		&fakeScheduleProfileRepository{
			profile: &models.PortfolioProfile{ID: 10, UserID: 5},
		},
		moex.NewMoexService("https://iss.amogos.pro/iss"),
	)

	_, err := service.Preview(context.Background(), 5, 10, &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart: time.Date(2026, 4, 13, 9, 0, 0, 0, time.UTC),
		RRule:   "INVALID_RULE",
	})
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected ErrInvalidRequest, got %v", err)
	}
}

func TestSchedulePreviewService_PreviewProfileNotFound(t *testing.T) {
	service := NewSchedulePreviewService(
		&fakeScheduleProfileRepository{
			err: gorm.ErrRecordNotFound,
		},
		moex.NewMoexService("https://iss.amogos.pro/iss"),
	)

	_, err := service.Preview(context.Background(), 5, 10, &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart: time.Date(2026, 4, 13, 9, 0, 0, 0, time.UTC),
		RRule:   "FREQ=DAILY;COUNT=3",
	})
	if !errors.Is(err, ErrProfileNotFound) {
		t.Fatalf("expected ErrProfileNotFound, got %v", err)
	}
}

func TestSchedulePreviewService_BuildsResolvedCalendarRowsForWindow(t *testing.T) {
	moexServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
  "engine": { "columns": ["NAME"], "data": [["stock"]] },
  "timetable": {
    "columns": ["week_day","is_work_day","start_time","stop_time"],
    "data": [[1,1,"10:00:00","18:30:00"]]
  },
  "dailytable": {
    "columns": ["date","is_work_day","start_time","stop_time"],
    "data": [["2026-04-14",0,"10:00:00","18:30:00"]]
  }
}`))
	}))
	defer moexServer.Close()

	service := NewSchedulePreviewService(
		&fakeScheduleProfileRepository{
			profile: &models.PortfolioProfile{ID: 10, UserID: 5},
		},
		moex.NewMoexService(moexServer.URL),
	)

	from := time.Date(2026, 4, 13, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 15, 23, 59, 59, 0, time.UTC)
	resp, err := service.Preview(context.Background(), 5, 10, &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart: from,
		RRule:   "FREQ=DAILY;COUNT=3",
		From:    &from,
		To:      &to,
	})
	if err != nil {
		t.Fatalf("Preview returned error: %v", err)
	}
	if len(resp.Moex.Calendar) != 3 {
		t.Fatalf("expected 3 calendar rows, got %d", len(resp.Moex.Calendar))
	}
	if resp.Moex.Calendar[0].Date != "2026-04-13" || resp.Moex.Calendar[0].Source != "timetable" {
		t.Fatalf("unexpected first calendar row: %+v", resp.Moex.Calendar[0])
	}
	if resp.Moex.Calendar[1].Date != "2026-04-14" || resp.Moex.Calendar[1].Source != "dailytable" {
		t.Fatalf("unexpected second calendar row: %+v", resp.Moex.Calendar[1])
	}
	if resp.Moex.Calendar[2].Date != "2026-04-15" || resp.Moex.Calendar[2].Source != "none" {
		t.Fatalf("unexpected third calendar row: %+v", resp.Moex.Calendar[2])
	}
}

type fakeScheduleProfileRepository struct {
	profile *models.PortfolioProfile
	err     error
}

func (f *fakeScheduleProfileRepository) GetByID(userID int, id int) (*models.PortfolioProfile, error) {
	if f.err != nil {
		return nil, f.err
	}
	if f.profile == nil {
		return nil, gorm.ErrRecordNotFound
	}
	return f.profile, nil
}
