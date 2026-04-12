package isdayoff

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultBaseURL = "https://isdayoff.ru"
	maxRangeDays   = 366
)

type DayStatus struct {
	Code      string
	Type      string
	IsWorkDay bool
}

type Service struct {
	baseURL string
	client  *http.Client
}

func NewService(baseURL string) *Service {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		trimmed = defaultBaseURL
	}
	return &Service{
		baseURL: trimmed,
		client: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

func (s *Service) GetRange(ctx context.Context, from, to time.Time) (map[string]DayStatus, error) {
	fromDate := normalizeDate(from)
	toDate := normalizeDate(to)
	if toDate.Before(fromDate) {
		fromDate, toDate = toDate, fromDate
	}

	result := make(map[string]DayStatus)
	for chunkFrom := fromDate; !chunkFrom.After(toDate); {
		chunkTo := chunkFrom.AddDate(0, 0, maxRangeDays-1)
		if chunkTo.After(toDate) {
			chunkTo = toDate
		}
		chunkRows, err := s.getChunk(ctx, chunkFrom, chunkTo)
		if err != nil {
			return nil, err
		}
		for key, value := range chunkRows {
			result[key] = value
		}
		chunkFrom = chunkTo.AddDate(0, 0, 1)
	}
	return result, nil
}

func (s *Service) getChunk(ctx context.Context, from, to time.Time) (map[string]DayStatus, error) {
	dayCount := int(to.Sub(from).Hours()/24) + 1
	if dayCount <= 0 {
		return map[string]DayStatus{}, nil
	}

	endpoint, err := url.Parse(s.baseURL + "/api/getdata")
	if err != nil {
		return nil, fmt.Errorf("build isdayoff endpoint: %w", err)
	}
	q := endpoint.Query()
	q.Set("date1", from.Format("20060102"))
	q.Set("date2", to.Format("20060102"))
	q.Set("cc", "ru")
	q.Set("pre", "1")
	q.Set("holiday", "1")
	q.Set("delimeter", "\n")
	endpoint.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("build isdayoff request: %w", err)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("isdayoff request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read isdayoff response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("isdayoff request failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	codes, err := parseCodes(string(body), dayCount)
	if err != nil {
		return nil, err
	}
	result := make(map[string]DayStatus, len(codes))
	for index, code := range codes {
		status, err := toDayStatus(code)
		if err != nil {
			return nil, err
		}
		day := from.AddDate(0, 0, index)
		result[day.Format("2006-01-02")] = status
	}
	return result, nil
}

func parseCodes(raw string, expected int) ([]string, error) {
	trimmed := strings.TrimSpace(strings.ReplaceAll(raw, "\r", ""))
	if trimmed == "" {
		return nil, fmt.Errorf("isdayoff response is empty")
	}

	lines := strings.Split(trimmed, "\n")
	if len(lines) == expected {
		return lines, nil
	}

	// Fallback for responses without delimiter support.
	if len(lines) == 1 && len(lines[0]) == expected {
		result := make([]string, 0, expected)
		for _, ch := range lines[0] {
			result = append(result, string(ch))
		}
		return result, nil
	}

	return nil, fmt.Errorf("unexpected isdayoff response length: got=%d expected=%d body=%q", len(lines), expected, trimmed)
}

func toDayStatus(code string) (DayStatus, error) {
	switch code {
	case "0":
		return DayStatus{Code: code, Type: "workday", IsWorkDay: true}, nil
	case "1":
		return DayStatus{Code: code, Type: "non_working_day", IsWorkDay: false}, nil
	case "2":
		return DayStatus{Code: code, Type: "shortened_workday", IsWorkDay: true}, nil
	case "4":
		return DayStatus{Code: code, Type: "special_workday", IsWorkDay: true}, nil
	case "8":
		return DayStatus{Code: code, Type: "public_holiday", IsWorkDay: false}, nil
	default:
		return DayStatus{}, fmt.Errorf("unexpected isdayoff day code: %q", code)
	}
}

func normalizeDate(value time.Time) time.Time {
	loc := value.Location()
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, loc)
}
