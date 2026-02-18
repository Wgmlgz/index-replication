package repository

import (
	"context"
	"sort"
	"strings"
	"time"

	"server/internal/models"

	"gorm.io/gorm"
)

type MoexCoverageRange struct {
	FromDate time.Time `json:"fromDate"`
	ToDate   time.Time `json:"toDate"`
}

type MoexSyncStateRow struct {
	Dataset             string     `json:"dataset"`
	EntityKey           string     `json:"entityKey"`
	CheckedThroughDate  *time.Time `json:"checkedThroughDate"`
	ImmutableBeforeDate *time.Time `json:"immutableBeforeDate"`
	MutableSinceDate    *time.Time `json:"mutableSinceDate"`
	Status              string     `json:"status"`
	LastSuccessAt       *time.Time `json:"lastSuccessAt"`
	LastAttemptAt       *time.Time `json:"lastAttemptAt"`
	RetryCount          int        `json:"retryCount"`
	LastError           *string    `json:"lastError"`
	UpdatedAt           time.Time  `json:"updatedAt"`
}

type MoexCoverageRow struct {
	Dataset    string    `json:"dataset"`
	EntityKey  string    `json:"entityKey"`
	FromDate   time.Time `json:"fromDate"`
	ToDate     time.Time `json:"toDate"`
	IsComplete bool      `json:"isComplete"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type MoexSyncRunRow struct {
	RunID         string     `json:"runId"`
	WorkflowID    *string    `json:"workflowId"`
	WorkflowRunID *string    `json:"workflowRunId"`
	Dataset       string     `json:"dataset"`
	EntityKey     string     `json:"entityKey"`
	Status        string     `json:"status"`
	StartedAt     time.Time  `json:"startedAt"`
	FinishedAt    *time.Time `json:"finishedAt"`
	FetchedRows   int        `json:"fetchedRows"`
	UpsertedRows  int        `json:"upsertedRows"`
	ErrorText     *string    `json:"errorText"`
	Details       *string    `json:"details"`
}

type MoexCompositionSeriesRow struct {
	Ticker    string
	TradeDate time.Time
	Weight    *float64
}

type moexCoverageScanRow struct {
	FromDate   time.Time `gorm:"column:from_date"`
	ToDate     time.Time `gorm:"column:to_date"`
	IsComplete bool      `gorm:"column:is_complete"`
}

type moexOverviewIndexRow struct {
	Secid          string     `gorm:"column:secid"`
	ShortName      string     `gorm:"column:short_name"`
	Name           string     `gorm:"column:name"`
	Currency       *string    `gorm:"column:currency"`
	Decimals       *int       `gorm:"column:decimals"`
	BoardID        *string    `gorm:"column:board_id"`
	CalcMode       *string    `gorm:"column:calc_mode"`
	AnnualHigh     *float64   `gorm:"column:annual_high"`
	AnnualLow      *float64   `gorm:"column:annual_low"`
	LastActiveDate *time.Time `gorm:"column:last_active_date"`
	HasComposition bool       `gorm:"column:has_composition"`
}

type MoexDataRepository struct {
	db *gorm.DB
}

func NewMoexDataRepository(db *gorm.DB) *MoexDataRepository {
	return &MoexDataRepository{db: db}
}

func (r *MoexDataRepository) GetOverview(ctx context.Context) (models.MoexIndexesOverviewResponse, error) {
	var indexRows []moexOverviewIndexRow
	if err := r.db.WithContext(ctx).
		Table("moex_indexes AS i").
		Select(`
			i.secid,
			i.short_name,
			i.name,
			i.currency,
			i.decimals,
			i.board_id,
			i.calc_mode,
			i.annual_high,
			i.annual_low,
			h.last_active_date,
			CASE WHEN c.index_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_composition
		`).
		Joins(`
			LEFT JOIN (
				SELECT secid, MAX(trade_date) AS last_active_date
				FROM moex_index_history_daily
				GROUP BY secid
			) AS h ON h.secid = i.secid
		`).
		Joins(`
			LEFT JOIN (
				SELECT DISTINCT index_id
				FROM moex_index_composition_daily
			) AS c ON c.index_id = i.secid
		`).
		Order("i.secid ASC").
		Find(&indexRows).Error; err != nil {
		return models.MoexIndexesOverviewResponse{}, err
	}

	var collectionRows []models.MoexIndexCollectionDB
	if err := r.db.WithContext(ctx).Order("id ASC").Find(&collectionRows).Error; err != nil {
		return models.MoexIndexesOverviewResponse{}, err
	}

	var membershipRows []models.MoexIndexCollectionMembershipDB
	if err := r.db.WithContext(ctx).Order("secid ASC, collection_name ASC").Find(&membershipRows).Error; err != nil {
		return models.MoexIndexesOverviewResponse{}, err
	}

	indexes := make([]models.MoexIndex, 0, len(indexRows))
	for _, row := range indexRows {
		var lastActiveDate *string
		if row.LastActiveDate != nil {
			formatted := row.LastActiveDate.UTC().Format("2006-01-02")
			lastActiveDate = &formatted
		}
		indexes = append(indexes, models.MoexIndex{
			Secid:          row.Secid,
			ShortName:      row.ShortName,
			Name:           row.Name,
			Currency:       row.Currency,
			Decimals:       row.Decimals,
			BoardID:        row.BoardID,
			CalcMode:       row.CalcMode,
			AnnualHigh:     row.AnnualHigh,
			AnnualLow:      row.AnnualLow,
			LastActiveDate: lastActiveDate,
			HasComposition: row.HasComposition,
		})
	}

	collections := make([]models.MoexIndexCollection, 0, len(collectionRows))
	for _, row := range collectionRows {
		collections = append(collections, models.MoexIndexCollection{
			ID:              row.ID,
			Name:            row.Name,
			Title:           row.Title,
			SecurityGroupID: row.SecurityGroupID,
		})
	}

	memberships := make(map[string][]string)
	for _, row := range membershipRows {
		memberships[row.Secid] = append(memberships[row.Secid], row.CollectionName)
	}

	return models.MoexIndexesOverviewResponse{
		Indexes:     indexes,
		Collections: collections,
		Memberships: memberships,
	}, nil
}

func (r *MoexDataRepository) ListHistoryPoints(ctx context.Context, secid string, fromDate, toDate *time.Time) ([]models.MoexIndexHistoryPoint, error) {
	q := r.db.WithContext(ctx).Table("moex_index_history_daily").
		Select("trade_date", "open", "high", "low", "close").
		Where("secid = ?", strings.TrimSpace(secid)).
		Order("trade_date ASC")
	if fromDate != nil {
		q = q.Where("trade_date >= ?", dateOnlyUTCDay(*fromDate))
	}
	if toDate != nil {
		q = q.Where("trade_date <= ?", dateOnlyUTCDay(*toDate))
	}

	var rows []struct {
		TradeDate time.Time `gorm:"column:trade_date"`
		Open      *float64  `gorm:"column:open"`
		High      *float64  `gorm:"column:high"`
		Low       *float64  `gorm:"column:low"`
		Close     *float64  `gorm:"column:close"`
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}

	points := make([]models.MoexIndexHistoryPoint, 0, len(rows))
	for _, row := range rows {
		points = append(points, models.MoexIndexHistoryPoint{
			TradeDate: row.TradeDate.UTC().Format("2006-01-02"),
			Open:      row.Open,
			High:      row.High,
			Low:       row.Low,
			Close:     row.Close,
		})
	}
	return points, nil
}

func (r *MoexDataRepository) ResolveCompositionDate(ctx context.Context, indexID string, preferredDate *time.Time) (*time.Time, error) {
	q := r.db.WithContext(ctx).Table("moex_index_composition_daily").
		Select("MAX(trade_date) as trade_date").
		Where("index_id = ?", strings.TrimSpace(indexID))
	if preferredDate != nil {
		q = q.Where("trade_date <= ?", dateOnlyUTCDay(*preferredDate))
	}

	var row struct {
		TradeDate *time.Time `gorm:"column:trade_date"`
	}
	if err := q.Scan(&row).Error; err != nil {
		return nil, err
	}
	if row.TradeDate == nil {
		return nil, nil
	}
	normalized := dateOnlyUTCDay(*row.TradeDate)
	return &normalized, nil
}

func (r *MoexDataRepository) ListCompositionByDate(ctx context.Context, indexID string, tradeDate time.Time) ([]models.MoexIndexCompositionEntry, error) {
	var rows []models.MoexIndexCompositionDailyDB
	if err := r.db.WithContext(ctx).
		Where("index_id = ? AND trade_date = ?", strings.TrimSpace(indexID), dateOnlyUTCDay(tradeDate)).
		Order("ticker ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]models.MoexIndexCompositionEntry, 0, len(rows))
	for _, row := range rows {
		var secID string
		if row.SecID != nil {
			secID = *row.SecID
		}
		var shortName string
		if row.ShortName != nil {
			shortName = *row.ShortName
		}
		var tradeSessionDate *string
		if row.TradeSessionDate != nil {
			formatted := row.TradeSessionDate.UTC().Format("2006-01-02")
			tradeSessionDate = &formatted
		}
		result = append(result, models.MoexIndexCompositionEntry{
			IndexID:          row.IndexID,
			TradeDate:        row.TradeDate.UTC().Format("2006-01-02"),
			Ticker:           row.Ticker,
			SecID:            secID,
			ShortName:        shortName,
			Weight:           row.Weight,
			TradeSessionDate: tradeSessionDate,
		})
	}
	return result, nil
}

func (r *MoexDataRepository) ListCompositionSeriesRows(ctx context.Context, indexID string, tickers []string, fromDate, toDate *time.Time) ([]MoexCompositionSeriesRow, error) {
	normalizedTickers := make([]string, 0, len(tickers))
	for _, ticker := range tickers {
		ticker = strings.TrimSpace(ticker)
		if ticker == "" {
			continue
		}
		normalizedTickers = append(normalizedTickers, ticker)
	}
	if len(normalizedTickers) == 0 {
		return []MoexCompositionSeriesRow{}, nil
	}

	q := r.db.WithContext(ctx).Table("moex_index_composition_daily").
		Select("ticker", "trade_date", "weight").
		Where("index_id = ? AND ticker IN ?", strings.TrimSpace(indexID), normalizedTickers).
		Order("ticker ASC, trade_date ASC")
	if fromDate != nil {
		q = q.Where("trade_date >= ?", dateOnlyUTCDay(*fromDate))
	}
	if toDate != nil {
		q = q.Where("trade_date <= ?", dateOnlyUTCDay(*toDate))
	}

	var rows []MoexCompositionSeriesRow
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *MoexDataRepository) EvaluateCoverage(ctx context.Context, dataset, entityKey string, fromDate, toDate time.Time) (string, []MoexCoverageRange, error) {
	fromDate = dateOnlyUTCDay(fromDate)
	toDate = dateOnlyUTCDay(toDate)
	if fromDate.After(toDate) {
		fromDate, toDate = toDate, fromDate
	}

	var rows []moexCoverageScanRow
	err := r.db.WithContext(ctx).
		Table("moex_data_coverage").
		Select("from_date", "to_date", "is_complete").
		Where("dataset = ? AND entity_key = ? AND to_date >= ? AND from_date <= ?", dataset, strings.TrimSpace(entityKey), fromDate, toDate).
		Order("from_date ASC, to_date ASC").
		Find(&rows).Error
	if err != nil {
		return "unknown", nil, err
	}
	if len(rows) == 0 {
		return "unknown", []MoexCoverageRange{{FromDate: fromDate, ToDate: toDate}}, nil
	}

	complete := make([]MoexCoverageRange, 0, len(rows))
	incomplete := make([]MoexCoverageRange, 0)
	for _, row := range rows {
		rangeFrom, rangeTo, ok := clipRange(dateOnlyUTCDay(row.FromDate), dateOnlyUTCDay(row.ToDate), fromDate, toDate)
		if !ok {
			continue
		}
		current := MoexCoverageRange{FromDate: rangeFrom, ToDate: rangeTo}
		if row.IsComplete {
			complete = append(complete, current)
		} else {
			incomplete = append(incomplete, current)
		}
	}

	complete = mergeCoverageRanges(complete)
	missingFromGaps := computeMissingCoverageRanges(fromDate, toDate, complete)
	missing := mergeCoverageRanges(append(incomplete, missingFromGaps...))

	if len(missing) == 0 {
		return "complete", nil, nil
	}
	return "incomplete", missing, nil
}

func (r *MoexDataRepository) ListSyncState(ctx context.Context, dataset, entityKey string, limit int) ([]MoexSyncStateRow, error) {
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	q := r.db.WithContext(ctx).Table("moex_sync_state")
	if strings.TrimSpace(dataset) != "" {
		q = q.Where("dataset = ?", strings.TrimSpace(dataset))
	}
	if strings.TrimSpace(entityKey) != "" {
		q = q.Where("entity_key = ?", strings.TrimSpace(entityKey))
	}

	var rows []MoexSyncStateRow
	err := q.Order("dataset ASC, entity_key ASC").Limit(limit).Find(&rows).Error
	return rows, err
}

func (r *MoexDataRepository) ListCoverage(ctx context.Context, dataset, entityKey string, fromDate, toDate *time.Time, limit int) ([]MoexCoverageRow, error) {
	if limit <= 0 || limit > 5000 {
		limit = 500
	}
	q := r.db.WithContext(ctx).Table("moex_data_coverage")
	if strings.TrimSpace(dataset) != "" {
		q = q.Where("dataset = ?", strings.TrimSpace(dataset))
	}
	if strings.TrimSpace(entityKey) != "" {
		q = q.Where("entity_key = ?", strings.TrimSpace(entityKey))
	}
	if fromDate != nil {
		q = q.Where("to_date >= ?", dateOnlyUTCDay(*fromDate))
	}
	if toDate != nil {
		q = q.Where("from_date <= ?", dateOnlyUTCDay(*toDate))
	}

	var rows []MoexCoverageRow
	err := q.Order("dataset ASC, entity_key ASC, from_date ASC").Limit(limit).Find(&rows).Error
	return rows, err
}

func (r *MoexDataRepository) ListSyncRuns(ctx context.Context, dataset, entityKey, status string, limit int) ([]MoexSyncRunRow, error) {
	if limit <= 0 || limit > 5000 {
		limit = 500
	}
	q := r.db.WithContext(ctx).Table("moex_sync_runs")
	if strings.TrimSpace(dataset) != "" {
		q = q.Where("dataset = ?", strings.TrimSpace(dataset))
	}
	if strings.TrimSpace(entityKey) != "" {
		q = q.Where("entity_key = ?", strings.TrimSpace(entityKey))
	}
	if strings.TrimSpace(status) != "" {
		q = q.Where("status = ?", strings.TrimSpace(status))
	}

	var rows []MoexSyncRunRow
	err := q.Order("started_at DESC").Limit(limit).Find(&rows).Error
	return rows, err
}

func dateOnlyUTCDay(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func clipRange(fromDate, toDate, minDate, maxDate time.Time) (time.Time, time.Time, bool) {
	if fromDate.After(toDate) {
		fromDate, toDate = toDate, fromDate
	}
	if fromDate.Before(minDate) {
		fromDate = minDate
	}
	if toDate.After(maxDate) {
		toDate = maxDate
	}
	if fromDate.After(toDate) {
		return time.Time{}, time.Time{}, false
	}
	return fromDate, toDate, true
}

func mergeCoverageRanges(ranges []MoexCoverageRange) []MoexCoverageRange {
	if len(ranges) == 0 {
		return nil
	}
	sort.Slice(ranges, func(i, j int) bool {
		if ranges[i].FromDate.Equal(ranges[j].FromDate) {
			return ranges[i].ToDate.Before(ranges[j].ToDate)
		}
		return ranges[i].FromDate.Before(ranges[j].FromDate)
	})

	merged := make([]MoexCoverageRange, 0, len(ranges))
	for _, current := range ranges {
		if len(merged) == 0 {
			merged = append(merged, current)
			continue
		}
		last := &merged[len(merged)-1]
		if current.FromDate.After(last.ToDate.AddDate(0, 0, 1)) {
			merged = append(merged, current)
			continue
		}
		if current.ToDate.After(last.ToDate) {
			last.ToDate = current.ToDate
		}
	}
	return merged
}

func computeMissingCoverageRanges(fromDate, toDate time.Time, mergedComplete []MoexCoverageRange) []MoexCoverageRange {
	if len(mergedComplete) == 0 {
		return []MoexCoverageRange{{FromDate: fromDate, ToDate: toDate}}
	}

	missing := make([]MoexCoverageRange, 0)
	cursor := fromDate
	for _, covered := range mergedComplete {
		if covered.ToDate.Before(cursor) {
			continue
		}
		if covered.FromDate.After(cursor) {
			missing = append(missing, MoexCoverageRange{
				FromDate: cursor,
				ToDate:   covered.FromDate.AddDate(0, 0, -1),
			})
		}
		nextCursor := covered.ToDate.AddDate(0, 0, 1)
		if nextCursor.After(cursor) {
			cursor = nextCursor
		}
		if cursor.After(toDate) {
			break
		}
	}
	if !cursor.After(toDate) {
		missing = append(missing, MoexCoverageRange{FromDate: cursor, ToDate: toDate})
	}
	return missing
}
