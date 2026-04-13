package repository

import (
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
	err := r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "portfolio_profile_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"is_enabled":              schedule.IsEnabled,
			"dtstart":                 schedule.DtStart,
			"rrule":                   schedule.RRule,
			"business_day_adjustment": schedule.BusinessDayAdjustment,
			"updated_at":              now,
		}),
	}).Create(schedule).Error
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
