package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"server/internal/models"
	moexdomain "server/internal/moex/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type MarketPriceRepository struct {
	db *gorm.DB
}

func NewMarketPriceRepository(db *gorm.DB) *MarketPriceRepository {
	return &MarketPriceRepository{db: db}
}

func (r *MarketPriceRepository) GetInstrumentMapping(ctx context.Context, provider, instrumentKey string) (*models.PortfolioInstrumentMappingDB, error) {
	normalizedProvider := strings.ToLower(strings.TrimSpace(provider))
	normalizedKey := strings.ToUpper(strings.TrimSpace(instrumentKey))
	if normalizedProvider == "" || normalizedKey == "" {
		return nil, nil
	}

	var row models.PortfolioInstrumentMappingDB
	err := r.db.WithContext(ctx).
		Where("provider = ? AND instrument_key = ?", normalizedProvider, normalizedKey).
		Take(&row).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *MarketPriceRepository) UpsertInstrumentMapping(ctx context.Context, row *models.PortfolioInstrumentMappingDB) error {
	if row == nil {
		return nil
	}
	row.Provider = strings.ToLower(strings.TrimSpace(row.Provider))
	row.InstrumentKey = strings.ToUpper(strings.TrimSpace(row.InstrumentKey))
	row.Secid = strings.ToUpper(strings.TrimSpace(row.Secid))
	row.Board = strings.ToUpper(strings.TrimSpace(row.Board))
	if row.Provider == "" || row.InstrumentKey == "" || row.Secid == "" || row.Board == "" {
		return fmt.Errorf("incomplete instrument mapping")
	}
	if row.Ticker != nil {
		ticker := strings.ToUpper(strings.TrimSpace(*row.Ticker))
		if ticker == "" {
			row.Ticker = nil
		} else {
			row.Ticker = &ticker
		}
	}
	if row.Currency != nil {
		currency := strings.ToUpper(strings.TrimSpace(*row.Currency))
		if currency == "" {
			row.Currency = nil
		} else {
			row.Currency = &currency
		}
	}

	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "provider"}, {Name: "instrument_key"}},
			DoUpdates: clause.Assignments(map[string]interface{}{
				"ticker":     row.Ticker,
				"currency":   row.Currency,
				"secid":      row.Secid,
				"board":      row.Board,
				"updated_at": time.Now().UTC(),
			}),
		}).
		Create(row).Error
}

func (r *MarketPriceRepository) ListSecurityHistory(
	ctx context.Context,
	secid, board string,
	fromDate, toDate *time.Time,
) ([]models.MoexSecurityHistoryPointRow, error) {
	normalizedSecid := strings.ToUpper(strings.TrimSpace(secid))
	normalizedBoard := strings.ToUpper(strings.TrimSpace(board))
	if normalizedSecid == "" || normalizedBoard == "" {
		return []models.MoexSecurityHistoryPointRow{}, nil
	}

	q := r.db.WithContext(ctx).
		Table("moex_security_history_daily").
		Select("trade_date", "open", "high", "low", "close").
		Where("secid = ? AND board = ?", normalizedSecid, normalizedBoard).
		Order("trade_date ASC")
	if fromDate != nil {
		q = q.Where("trade_date >= ?", dateOnlyUTCDay(*fromDate))
	}
	if toDate != nil {
		q = q.Where("trade_date <= ?", dateOnlyUTCDay(*toDate))
	}

	var rows []models.MoexSecurityHistoryPointRow
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *MarketPriceRepository) GetLatestSecurityCloseOnOrBefore(
	ctx context.Context,
	secid, board string,
	date time.Time,
) (*models.MoexSecurityLatestCloseRow, error) {
	normalizedSecid := strings.ToUpper(strings.TrimSpace(secid))
	normalizedBoard := strings.ToUpper(strings.TrimSpace(board))
	if normalizedSecid == "" || normalizedBoard == "" {
		return nil, nil
	}

	var row models.MoexSecurityLatestCloseRow
	err := r.db.WithContext(ctx).
		Table("moex_security_history_daily").
		Select("trade_date", "close").
		Where("secid = ? AND board = ? AND trade_date <= ?", normalizedSecid, normalizedBoard, dateOnlyUTCDay(date)).
		Order("trade_date DESC").
		Limit(1).
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	if row.Close == nil || row.TradeDate.IsZero() {
		return nil, nil
	}
	return &row, nil
}

func (r *MarketPriceRepository) UpsertSecurityHistory(
	ctx context.Context,
	secid, board string,
	points []moexdomain.IndexHistoryPoint,
) (int, error) {
	normalizedSecid := strings.ToUpper(strings.TrimSpace(secid))
	normalizedBoard := strings.ToUpper(strings.TrimSpace(board))
	if normalizedSecid == "" || normalizedBoard == "" {
		return 0, fmt.Errorf("empty secid/board")
	}

	rows := make([]models.MoexSecurityHistoryDailyDB, 0, len(points))
	ingestedAt := time.Now().UTC()
	for _, point := range points {
		tradeDateRaw := strings.TrimSpace(point.TradeDate)
		if tradeDateRaw == "" {
			continue
		}
		tradeDate, err := time.Parse("2006-01-02", tradeDateRaw)
		if err != nil {
			continue
		}
		rows = append(rows, models.MoexSecurityHistoryDailyDB{
			Secid:      normalizedSecid,
			Board:      normalizedBoard,
			TradeDate:  dateOnlyUTCDay(tradeDate),
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
			Columns: []clause.Column{{Name: "secid"}, {Name: "board"}, {Name: "trade_date"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"open", "high", "low", "close", "source_updated_at", "ingested_at",
			}),
		}).
		CreateInBatches(&rows, 500).Error
	if err != nil {
		return 0, err
	}
	return len(rows), nil
}
