package activities

import (
	"testing"
	"time"
)

func TestSplitRangeByYearReturnsNewestToOldest(t *testing.T) {
	from := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2022, 12, 31, 0, 0, 0, 0, time.UTC)

	windows := splitRangeByYear(from, to)
	if len(windows) != 3 {
		t.Fatalf("expected 3 windows, got %d", len(windows))
	}

	if got := windows[0].From.Format("2006-01-02"); got != "2022-01-01" {
		t.Fatalf("expected first window from 2022-01-01, got %s", got)
	}
	if got := windows[0].To.Format("2006-01-02"); got != "2022-12-31" {
		t.Fatalf("expected first window to 2022-12-31, got %s", got)
	}
	if got := windows[2].From.Format("2006-01-02"); got != "2020-01-01" {
		t.Fatalf("expected last window from 2020-01-01, got %s", got)
	}
	if got := windows[2].To.Format("2006-01-02"); got != "2020-12-31" {
		t.Fatalf("expected last window to 2020-12-31, got %s", got)
	}
}

func TestSplitRangeByYearSwappedInputStillNewestToOldest(t *testing.T) {
	from := time.Date(2022, 3, 15, 0, 0, 0, 0, time.UTC)
	to := time.Date(2020, 8, 10, 0, 0, 0, 0, time.UTC)

	windows := splitRangeByYear(from, to)
	if len(windows) != 3 {
		t.Fatalf("expected 3 windows, got %d", len(windows))
	}

	if got := windows[0].From.Format("2006-01-02"); got != "2022-01-01" {
		t.Fatalf("expected first window from 2022-01-01, got %s", got)
	}
	if got := windows[0].To.Format("2006-01-02"); got != "2022-03-15" {
		t.Fatalf("expected first window to 2022-03-15, got %s", got)
	}
	if got := windows[2].From.Format("2006-01-02"); got != "2020-08-10" {
		t.Fatalf("expected last window from 2020-08-10, got %s", got)
	}
	if got := windows[2].To.Format("2006-01-02"); got != "2020-12-31" {
		t.Fatalf("expected last window to 2020-12-31, got %s", got)
	}
}
