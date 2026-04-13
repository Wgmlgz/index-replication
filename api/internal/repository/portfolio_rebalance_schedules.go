package repository

import (
	"context"
	"strings"
	"time"

	"server/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PortfolioRebalanceSchedulesRepository struct {
	db *gorm.DB
}

func NewPortfolioRebalanceSchedulesRepository(db *gorm.DB) *PortfolioRebalanceSchedulesRepository {
	return &PortfolioRebalanceSchedulesRepository{db: db}
}

func (r *PortfolioRebalanceSchedulesRepository) GetByPortfolioProfileID(profileID int) (*models.PortfolioRebalanceSchedule, error) {
	var row models.PortfolioRebalanceSchedule
	err := r.db.Where("portfolio_profile_id = ?", profileID).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *PortfolioRebalanceSchedulesRepository) GetByID(scheduleID int) (*models.PortfolioRebalanceSchedule, error) {
	var row models.PortfolioRebalanceSchedule
	err := r.db.Where("id = ?", scheduleID).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *PortfolioRebalanceSchedulesRepository) ListEnabled() ([]models.PortfolioRebalanceSchedule, error) {
	rows := make([]models.PortfolioRebalanceSchedule, 0)
	if err := r.db.
		Where("is_enabled = ?", true).
		Order("id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *PortfolioRebalanceSchedulesRepository) Upsert(
	schedule *models.PortfolioRebalanceSchedule,
) (*models.PortfolioRebalanceSchedule, error) {
	if schedule == nil {
		return nil, gorm.ErrInvalidData
	}

	schedule.RRule = strings.TrimSpace(schedule.RRule)
	schedule.BusinessDayAdjustment = strings.TrimSpace(schedule.BusinessDayAdjustment)
	if schedule.BusinessDayAdjustment == "" {
		schedule.BusinessDayAdjustment = "strict"
	}
	if schedule.RRule == "" || schedule.DtStart.IsZero() {
		return nil, gorm.ErrInvalidData
	}

	now := time.Now().UTC()
	insertValues := map[string]interface{}{
		"portfolio_profile_id":    schedule.PortfolioProfileID,
		"is_enabled":              schedule.IsEnabled,
		"dtstart":                 schedule.DtStart,
		"rrule":                   schedule.RRule,
		"business_day_adjustment": schedule.BusinessDayAdjustment,
	}
	err := r.db.Model(&models.PortfolioRebalanceSchedule{}).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "portfolio_profile_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"is_enabled":              schedule.IsEnabled,
			"dtstart":                 schedule.DtStart,
			"rrule":                   schedule.RRule,
			"business_day_adjustment": schedule.BusinessDayAdjustment,
			"updated_at":              now,
		}),
	}).Create(insertValues).Error
	if err != nil {
		return nil, err
	}

	return r.GetByPortfolioProfileID(schedule.PortfolioProfileID)
}

func (r *PortfolioRebalanceSchedulesRepository) SetNextRunAtByPortfolioProfileID(profileID int, nextRunAt *time.Time) error {
	return r.updateRuntimeFieldByPortfolioProfileID(profileID, "next_run_at", nextRunAt)
}

func (r *PortfolioRebalanceSchedulesRepository) SetLastRunAtByPortfolioProfileID(profileID int, lastRunAt *time.Time) error {
	return r.updateRuntimeFieldByPortfolioProfileID(profileID, "last_run_at", lastRunAt)
}

func (r *PortfolioRebalanceSchedulesRepository) SetLastErrorByPortfolioProfileID(profileID int, lastError *string) error {
	return r.updateRuntimeFieldByPortfolioProfileID(profileID, "last_error", lastError)
}

func (r *PortfolioRebalanceSchedulesRepository) SetLastRunIDByPortfolioProfileID(profileID int, lastRunID *int) error {
	return r.updateRuntimeFieldByPortfolioProfileID(profileID, "last_run_id", lastRunID)
}

func (r *PortfolioRebalanceSchedulesRepository) GetPortfolioProfileOwnerID(ctx context.Context, profileID int) (int, error) {
	var ownerID int
	err := r.db.WithContext(ctx).
		Table("portfolio_profiles").
		Select("user_id").
		Where("id = ?", profileID).
		Scan(&ownerID).Error
	if err != nil {
		return 0, err
	}
	if ownerID <= 0 {
		return 0, gorm.ErrRecordNotFound
	}
	return ownerID, nil
}

func (r *PortfolioRebalanceSchedulesRepository) ClaimDueAndAdvanceNextRun(
	ctx context.Context,
	scheduleID int,
	profileID int,
	dueAt time.Time,
	nextRunAt *time.Time,
) (bool, error) {
	dueAt = dueAt.UTC()
	nextRunAt = normalizeUTCTimePtr(nextRunAt)
	claimed := false

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		updateTx := tx.Model(&models.PortfolioRebalanceSchedule{}).
			Where(
				"id = ? AND portfolio_profile_id = ? AND is_enabled = ? AND (next_run_at = ? OR next_run_at IS NULL)",
				scheduleID,
				profileID,
				true,
				dueAt,
			).
			Updates(map[string]interface{}{
				"next_run_at": nextRunAt,
				"updated_at":  time.Now().UTC(),
			})
		if updateTx.Error != nil {
			return updateTx.Error
		}
		claimed = updateTx.RowsAffected > 0

		return nil
	})
	if err != nil {
		return false, err
	}

	return claimed, nil
}

func (r *PortfolioRebalanceSchedulesRepository) MarkDispatchPlanningSuccess(
	ctx context.Context,
	scheduleID int,
	dueAt time.Time,
	runID int,
) error {
	if scheduleID <= 0 || runID <= 0 {
		return gorm.ErrInvalidData
	}
	dueAt = dueAt.UTC()

	updateSchedule := r.db.WithContext(ctx).
		Model(&models.PortfolioRebalanceSchedule{}).
		Where("id = ?", scheduleID).
		Updates(map[string]interface{}{
			"last_run_at": dueAt,
			"last_run_id": runID,
			"last_error":  nil,
			"updated_at":  time.Now().UTC(),
		})
	if updateSchedule.Error != nil {
		return updateSchedule.Error
	}
	if updateSchedule.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *PortfolioRebalanceSchedulesRepository) MarkDispatchPlanningFailure(
	ctx context.Context,
	scheduleID int,
	lastError string,
) error {
	if scheduleID <= 0 {
		return gorm.ErrInvalidData
	}
	lastError = strings.TrimSpace(lastError)
	errorPtr := errorStringPtr(lastError)

	updateSchedule := r.db.WithContext(ctx).
		Model(&models.PortfolioRebalanceSchedule{}).
		Where("id = ?", scheduleID).
		Updates(map[string]interface{}{
			"last_error": errorPtr,
			"updated_at": time.Now().UTC(),
		})
	if updateSchedule.Error != nil {
		return updateSchedule.Error
	}
	if updateSchedule.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *PortfolioRebalanceSchedulesRepository) DeleteByPortfolioProfileID(profileID int) (bool, error) {
	tx := r.db.Where("portfolio_profile_id = ?", profileID).Delete(&models.PortfolioRebalanceSchedule{})
	if tx.Error != nil {
		return false, tx.Error
	}
	return tx.RowsAffected > 0, nil
}

func (r *PortfolioRebalanceSchedulesRepository) updateRuntimeFieldByPortfolioProfileID(profileID int, column string, value interface{}) error {
	tx := r.db.Model(&models.PortfolioRebalanceSchedule{}).
		Where("portfolio_profile_id = ?", profileID).
		Updates(map[string]interface{}{
			column:       value,
			"updated_at": time.Now().UTC(),
		})
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func normalizeUTCTimePtr(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	copy := value.UTC()
	return &copy
}

func errorStringPtr(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
