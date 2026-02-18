package repository

import (
	"context"
	"errors"
	"fmt"
	"server/internal/models"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	MoexSyncStatusRunning = "running"
	MoexSyncStatusOK      = "ok"
	MoexSyncStatusError   = "error"
)

type MoexSyncState struct {
	Dataset             string     `gorm:"column:dataset"`
	EntityKey           string     `gorm:"column:entity_key"`
	CheckedThroughDate  *time.Time `gorm:"column:checked_through_date"`
	ImmutableBeforeDate *time.Time `gorm:"column:immutable_before_date"`
	MutableSinceDate    *time.Time `gorm:"column:mutable_since_date"`
}

type MoexSyncRepository struct {
	db *gorm.DB
}

type MoexIncompleteCoverageRange struct {
	FromDate time.Time `gorm:"column:from_date"`
	ToDate   time.Time `gorm:"column:to_date"`
}

func NewMoexSyncRepository(db *gorm.DB) *MoexSyncRepository {
	return &MoexSyncRepository{db: db}
}

func (r *MoexSyncRepository) ReplaceOverview(ctx context.Context, overview models.MoexIndexesOverviewResponse) error {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return tx.Error
	}
	defer func() {
		if recover() != nil {
			_ = tx.Rollback()
		}
	}()

	indexRows := make([]models.MoexIndexDB, 0, len(overview.Indexes))
	for _, item := range overview.Indexes {
		indexRows = append(indexRows, models.MoexIndexDB{
			Secid:      item.Secid,
			ShortName:  item.ShortName,
			Name:       item.Name,
			Currency:   item.Currency,
			Decimals:   item.Decimals,
			BoardID:    item.BoardID,
			CalcMode:   item.CalcMode,
			AnnualHigh: item.AnnualHigh,
			AnnualLow:  item.AnnualLow,
			UpdatedAt:  time.Now().UTC(),
		})
	}

	collectionRows := make([]models.MoexIndexCollectionDB, 0, len(overview.Collections))
	for _, item := range overview.Collections {
		collectionRows = append(collectionRows, models.MoexIndexCollectionDB{
			ID:              item.ID,
			Name:            item.Name,
			Title:           item.Title,
			SecurityGroupID: item.SecurityGroupID,
			UpdatedAt:       time.Now().UTC(),
		})
	}

	membershipRows := make([]models.MoexIndexCollectionMembershipDB, 0)
	for secid, collections := range overview.Memberships {
		normalizedSecid := strings.TrimSpace(secid)
		if normalizedSecid == "" {
			continue
		}
		for _, collection := range collections {
			normalizedCollection := strings.TrimSpace(collection)
			if normalizedCollection == "" {
				continue
			}
			membershipRows = append(membershipRows, models.MoexIndexCollectionMembershipDB{
				Secid:          normalizedSecid,
				CollectionName: normalizedCollection,
				UpdatedAt:      time.Now().UTC(),
			})
		}
	}

	if err := tx.Exec("DELETE FROM moex_index_collection_memberships").Error; err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Exec("DELETE FROM moex_index_collections").Error; err != nil {
		_ = tx.Rollback()
		return err
	}
	if err := tx.Exec("DELETE FROM moex_indexes").Error; err != nil {
		_ = tx.Rollback()
		return err
	}

	if len(indexRows) > 0 {
		if err := tx.Create(&indexRows).Error; err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	if len(collectionRows) > 0 {
		if err := tx.Create(&collectionRows).Error; err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	if len(membershipRows) > 0 {
		if err := tx.Create(&membershipRows).Error; err != nil {
			_ = tx.Rollback()
			return err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}
	return nil
}

func (r *MoexSyncRepository) ListIndexSecids(ctx context.Context) ([]string, error) {
	var secids []string
	err := r.db.WithContext(ctx).
		Table("moex_indexes").
		Order("secid ASC").
		Pluck("secid", &secids).Error
	if err != nil {
		return nil, err
	}
	return secids, nil
}

func (r *MoexSyncRepository) GetSyncState(ctx context.Context, dataset, entityKey string) (*MoexSyncState, error) {
	var state MoexSyncState
	err := r.db.WithContext(ctx).
		Table("moex_sync_state").
		Select("dataset", "entity_key", "checked_through_date", "immutable_before_date", "mutable_since_date").
		Where("dataset = ? AND entity_key = ?", dataset, entityKey).
		Take(&state).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &state, nil
}

func (r *MoexSyncRepository) UpsertHistoryPoints(ctx context.Context, secid string, points []models.MoexIndexHistoryPoint) (int, error) {
	trimmedSecid := strings.TrimSpace(secid)
	if trimmedSecid == "" {
		return 0, fmt.Errorf("empty secid")
	}

	rows := make([]models.MoexIndexHistoryDailyDB, 0, len(points))
	ingestedAt := time.Now().UTC()
	for _, point := range points {
		if point.TradeDate == "" {
			continue
		}
		tradeDate, err := time.Parse("2006-01-02", point.TradeDate)
		if err != nil {
			continue
		}
		tradeDate = dateOnlyUTC(tradeDate)
		rows = append(rows, models.MoexIndexHistoryDailyDB{
			Secid:      trimmedSecid,
			TradeDate:  tradeDate,
			Open:       point.Open,
			High:       point.High,
			Low:        point.Low,
			Close:      point.Close,
			IngestedAt: ingestedAt,
		})
	}
	if len(rows) == 0 {
		return 0, nil
	}

	err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "secid"}, {Name: "trade_date"}},
			DoUpdates: clause.AssignmentColumns([]string{"open", "high", "low", "close", "source_updated_at", "ingested_at"}),
		}).
		CreateInBatches(&rows, 500).Error
	if err != nil {
		return 0, err
	}
	return len(rows), nil
}

func (r *MoexSyncRepository) UpsertCompositionEntries(ctx context.Context, indexID string, entries []models.MoexIndexCompositionEntry) (int, error) {
	trimmedIndexID := strings.TrimSpace(indexID)
	if trimmedIndexID == "" {
		return 0, fmt.Errorf("empty index id")
	}

	rows := make([]models.MoexIndexCompositionDailyDB, 0, len(entries))
	ingestedAt := time.Now().UTC()
	for _, entry := range entries {
		if entry.TradeDate == "" || strings.TrimSpace(entry.Ticker) == "" {
			continue
		}
		tradeDate, err := time.Parse("2006-01-02", entry.TradeDate)
		if err != nil {
			continue
		}
		var tradeSessionDate *time.Time
		if entry.TradeSessionDate != nil && strings.TrimSpace(*entry.TradeSessionDate) != "" {
			if parsed, parseErr := time.Parse("2006-01-02", strings.TrimSpace(*entry.TradeSessionDate)); parseErr == nil {
				normalized := dateOnlyUTC(parsed)
				tradeSessionDate = &normalized
			}
		}

		var secID *string
		trimmedSecID := strings.TrimSpace(entry.SecID)
		if trimmedSecID != "" {
			secID = &trimmedSecID
		}
		var shortName *string
		trimmedShortName := strings.TrimSpace(entry.ShortName)
		if trimmedShortName != "" {
			shortName = &trimmedShortName
		}

		rows = append(rows, models.MoexIndexCompositionDailyDB{
			IndexID:          trimmedIndexID,
			TradeDate:        dateOnlyUTC(tradeDate),
			Ticker:           strings.TrimSpace(entry.Ticker),
			SecID:            secID,
			ShortName:        shortName,
			Weight:           entry.Weight,
			TradeSessionDate: tradeSessionDate,
			IngestedAt:       ingestedAt,
		})
	}
	if len(rows) == 0 {
		return 0, nil
	}

	err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "index_id"}, {Name: "trade_date"}, {Name: "ticker"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"secid", "short_name", "weight", "trade_session_date", "ingested_at",
			}),
		}).
		CreateInBatches(&rows, 500).Error
	if err != nil {
		return 0, err
	}
	return len(rows), nil
}

func (r *MoexSyncRepository) UpsertCoverage(ctx context.Context, dataset, entityKey string, fromDate, toDate time.Time, isComplete bool) error {
	fromDate = dateOnlyUTC(fromDate)
	toDate = dateOnlyUTC(toDate)
	if fromDate.After(toDate) {
		fromDate, toDate = toDate, fromDate
	}
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO moex_data_coverage(dataset, entity_key, from_date, to_date, is_complete, updated_at)
		 VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(dataset, entity_key, from_date, to_date)
		 DO UPDATE SET is_complete = excluded.is_complete, updated_at = excluded.updated_at`,
		dataset, entityKey, fromDate, toDate, isComplete,
	).Error
}

func (r *MoexSyncRepository) ListIncompleteCoverage(ctx context.Context, dataset, entityKey string, fromDate, toDate time.Time) ([]MoexIncompleteCoverageRange, error) {
	fromDate = dateOnlyUTC(fromDate)
	toDate = dateOnlyUTC(toDate)
	if fromDate.After(toDate) {
		fromDate, toDate = toDate, fromDate
	}

	var rows []MoexIncompleteCoverageRange
	err := r.db.WithContext(ctx).
		Table("moex_data_coverage").
		Select("from_date", "to_date").
		Where("dataset = ? AND entity_key = ? AND is_complete = ? AND to_date >= ? AND from_date <= ?", dataset, entityKey, false, fromDate, toDate).
		Order("from_date ASC, to_date ASC").
		Find(&rows).Error
	return rows, err
}

func (r *MoexSyncRepository) StartSyncRun(ctx context.Context, runID, workflowID, workflowRunID, dataset, entityKey string) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO moex_sync_runs(run_id, workflow_id, workflow_run_id, dataset, entity_key, status, started_at)
		 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		runID, workflowID, workflowRunID, dataset, entityKey, MoexSyncStatusRunning,
	).Error
}

func (r *MoexSyncRepository) FinishSyncRun(ctx context.Context, runID, status string, fetchedRows, upsertedRows int, errorText, details string) error {
	return r.db.WithContext(ctx).Exec(
		`UPDATE moex_sync_runs
		 SET status = ?, finished_at = CURRENT_TIMESTAMP, fetched_rows = ?, upserted_rows = ?, error_text = ?, details = ?
		 WHERE run_id = ?`,
		status, fetchedRows, upsertedRows, nullableTrimmed(errorText), nullableTrimmed(details), runID,
	).Error
}

func (r *MoexSyncRepository) MarkSyncRunning(ctx context.Context, dataset, entityKey string) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO moex_sync_state(dataset, entity_key, status, last_attempt_at, updated_at)
		 VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		 ON CONFLICT(dataset, entity_key)
		 DO UPDATE SET status = excluded.status, last_attempt_at = excluded.last_attempt_at, updated_at = excluded.updated_at`,
		dataset, entityKey, MoexSyncStatusRunning,
	).Error
}

func (r *MoexSyncRepository) MarkSyncSuccess(ctx context.Context, dataset, entityKey string) error {
	return r.MarkSyncSuccessWithState(ctx, dataset, entityKey, nil, nil, nil)
}

func (r *MoexSyncRepository) MarkSyncSuccessWithState(ctx context.Context, dataset, entityKey string, checkedThroughDate, immutableBeforeDate, mutableSinceDate *time.Time) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO moex_sync_state(dataset, entity_key, status, checked_through_date, immutable_before_date, mutable_since_date, last_success_at, last_attempt_at, retry_count, last_error, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, NULL, CURRENT_TIMESTAMP)
		 ON CONFLICT(dataset, entity_key)
		 DO UPDATE SET status = excluded.status,
		               checked_through_date = COALESCE(excluded.checked_through_date, moex_sync_state.checked_through_date),
		               immutable_before_date = COALESCE(excluded.immutable_before_date, moex_sync_state.immutable_before_date),
		               mutable_since_date = COALESCE(excluded.mutable_since_date, moex_sync_state.mutable_since_date),
		               last_success_at = excluded.last_success_at,
		               last_attempt_at = excluded.last_attempt_at,
		               retry_count = 0,
		               last_error = NULL,
		               updated_at = excluded.updated_at`,
		dataset, entityKey, MoexSyncStatusOK, checkedThroughDate, immutableBeforeDate, mutableSinceDate,
	).Error
}

func (r *MoexSyncRepository) MarkSyncError(ctx context.Context, dataset, entityKey, errMsg string) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO moex_sync_state(dataset, entity_key, status, last_attempt_at, retry_count, last_error, updated_at)
		 VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(dataset, entity_key)
		 DO UPDATE SET status = excluded.status,
		               last_attempt_at = excluded.last_attempt_at,
		               retry_count = moex_sync_state.retry_count + 1,
		               last_error = excluded.last_error,
		               updated_at = excluded.updated_at`,
		dataset, entityKey, MoexSyncStatusError, strings.TrimSpace(errMsg),
	).Error
}

func dateOnlyUTC(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func nullableTrimmed(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
