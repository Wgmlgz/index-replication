package rebalance

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"server/internal/api/dto"
	"server/internal/isdayoff"
	"server/internal/models"

	"gorm.io/gorm"
)

func TestSchedulePreviewService_PreviewFiltersByTradingWindowAndWorkday(t *testing.T) {
	dayoffServer := newIsDayOffMockServer(t, map[string]string{
		"2026-04-13": "0",
	})
	defer dayoffServer.Close()

	service := NewSchedulePreviewService(
		&fakeScheduleProfileRepository{
			profile: &models.PortfolioProfile{ID: 10, UserID: 5},
		},
		isdayoff.NewService(dayoffServer.URL),
		"UTC",
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
	if len(resp.Events) != 5 {
		t.Fatalf("expected 5 filtered events, got %d", len(resp.Events))
	}
	if len(resp.Calendar) != 1 {
		t.Fatalf("expected 1 calendar row, got %d", len(resp.Calendar))
	}
	if resp.Calendar[0].Date != "2026-04-13" {
		t.Fatalf("expected calendar date 2026-04-13, got %s", resp.Calendar[0].Date)
	}
	if resp.Calendar[0].Source != "isdayoff" {
		t.Fatalf("expected calendar source isdayoff, got %s", resp.Calendar[0].Source)
	}
	if resp.Calendar[0].DayCode != "0" || resp.Calendar[0].DayType != "workday" {
		t.Fatalf("unexpected day status: %+v", resp.Calendar[0])
	}
	if resp.Calendar[0].StartTime == nil || *resp.Calendar[0].StartTime != "10:00" {
		t.Fatalf("expected start_time 10:00, got %+v", resp.Calendar[0].StartTime)
	}
	if resp.Calendar[0].StopTime == nil || *resp.Calendar[0].StopTime != "18:40" {
		t.Fatalf("expected stop_time 18:40, got %+v", resp.Calendar[0].StopTime)
	}
	expected := []string{
		"2026-04-13T10:00:00Z",
		"2026-04-13T11:00:00Z",
		"2026-04-13T12:00:00Z",
		"2026-04-13T13:00:00Z",
		"2026-04-13T14:00:00Z",
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
		isdayoff.NewService("https://isdayoff.ru"),
		"UTC",
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
		isdayoff.NewService("https://isdayoff.ru"),
		"UTC",
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
	dayoffServer := newIsDayOffMockServer(t, map[string]string{
		"2026-04-13": "0",
		"2026-04-14": "8",
		"2026-04-15": "1",
	})
	defer dayoffServer.Close()

	service := NewSchedulePreviewService(
		&fakeScheduleProfileRepository{
			profile: &models.PortfolioProfile{ID: 10, UserID: 5},
		},
		isdayoff.NewService(dayoffServer.URL),
		"UTC",
	)

	from := time.Date(2026, 4, 13, 11, 0, 0, 0, time.UTC)
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
	if len(resp.Events) != 1 {
		t.Fatalf("expected one accepted event on workday, got %d", len(resp.Events))
	}
	if len(resp.Calendar) != 3 {
		t.Fatalf("expected 3 calendar rows, got %d", len(resp.Calendar))
	}
	if resp.Calendar[0].Date != "2026-04-13" || resp.Calendar[0].DayType != "workday" {
		t.Fatalf("unexpected first calendar row: %+v", resp.Calendar[0])
	}
	if resp.Calendar[1].Date != "2026-04-14" || resp.Calendar[1].DayType != "public_holiday" {
		t.Fatalf("unexpected second calendar row: %+v", resp.Calendar[1])
	}
	if resp.Calendar[2].Date != "2026-04-15" || resp.Calendar[2].DayType != "non_working_day" {
		t.Fatalf("unexpected third calendar row: %+v", resp.Calendar[2])
	}
}

func TestSchedulePreviewService_UsesMoscowTimezoneForWindowAndCalendarDay(t *testing.T) {
	dayoffServer := newIsDayOffMockServer(t, map[string]string{
		"2026-03-01": "0",
	})
	defer dayoffServer.Close()

	service := NewSchedulePreviewService(
		&fakeScheduleProfileRepository{
			profile: &models.PortfolioProfile{ID: 10, UserID: 5},
		},
		isdayoff.NewService(dayoffServer.URL),
		"Europe/Moscow",
	)

	// 07:30Z = 10:30 MSK (inside trading window), 21:30Z = 00:30 MSK (outside).
	dtStart := time.Date(2026, 3, 1, 7, 30, 0, 0, time.UTC)
	from := time.Date(2026, 3, 1, 7, 0, 0, 0, time.UTC)
	to := time.Date(2026, 3, 1, 22, 0, 0, 0, time.UTC)
	resp, err := service.Preview(context.Background(), 5, 10, &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart: dtStart,
		RRule:   "FREQ=HOURLY;COUNT=3",
		From:    &from,
		To:      &to,
	})
	if err != nil {
		t.Fatalf("Preview returned error: %v", err)
	}
	if len(resp.Events) != 3 {
		t.Fatalf("expected 3 events in Moscow trading window, got %d", len(resp.Events))
	}

	outsideStart := time.Date(2026, 3, 1, 21, 30, 0, 0, time.UTC)
	outsideResp, err := service.Preview(context.Background(), 5, 10, &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart: outsideStart,
		RRule:   "FREQ=DAILY;COUNT=1",
		From:    &from,
		To:      &to,
	})
	if err != nil {
		t.Fatalf("Preview returned error: %v", err)
	}
	if len(outsideResp.Events) != 0 {
		t.Fatalf("expected 0 events for outside session time, got %d", len(outsideResp.Events))
	}
}

func TestSchedulePreviewService_MonthlyModifiedFollowingKeepsOneEventPerMonth(t *testing.T) {
	dayoffServer := newIsDayOffMockServer(t, map[string]string{
		"2026-02-27": "0",
		"2026-02-28": "1",
		"2026-03-30": "0",
		"2026-03-31": "1",
		"2026-04-30": "0",
	})
	defer dayoffServer.Close()

	service := NewSchedulePreviewService(
		&fakeScheduleProfileRepository{
			profile: &models.PortfolioProfile{ID: 10, UserID: 5},
		},
		isdayoff.NewService(dayoffServer.URL),
		"UTC",
	)

	from := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 4, 30, 23, 59, 59, 0, time.UTC)
	req := &dto.PortfolioRebalanceSchedulePreviewRequest{
		DtStart:               time.Date(2026, 2, 1, 11, 0, 0, 0, time.UTC),
		RRule:                 "FREQ=MONTHLY;BYMONTHDAY=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31;BYSETPOS=-1;COUNT=3",
		BusinessDayAdjustment: "modified_following",
		From:                  &from,
		To:                    &to,
	}
	resp, err := service.Preview(context.Background(), 5, 10, req)
	if err != nil {
		t.Fatalf("Preview returned error: %v", err)
	}
	if len(resp.Events) != 3 {
		t.Fatalf("expected 3 monthly events, got %d", len(resp.Events))
	}

	expected := []string{
		"2026-02-27T11:00:00Z",
		"2026-03-30T11:00:00Z",
		"2026-04-30T11:00:00Z",
	}
	for i, event := range resp.Events {
		if got := event.Format(time.RFC3339); got != expected[i] {
			t.Fatalf("unexpected event at index %d: got %s want %s", i, got, expected[i])
		}
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

func newIsDayOffMockServer(t *testing.T, statuses map[string]string) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/getdata" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		date1 := r.URL.Query().Get("date1")
		date2 := r.URL.Query().Get("date2")
		if date1 == "" || date2 == "" {
			t.Fatalf("date1/date2 are required")
		}

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
			key := day.Format("2006-01-02")
			code, ok := statuses[key]
			if !ok {
				code = "1"
			}
			if len(rows) > 0 {
				rows = append(rows, '\n')
			}
			rows = append(rows, []byte(code)...)
		}

		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write(rows)
	}))
}
