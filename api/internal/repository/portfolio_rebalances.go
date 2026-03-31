package repository

import (
	"server/internal/models"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type PortfolioRebalancesRepository struct {
	db *gorm.DB
}

func NewPortfolioRebalancesRepository(db *gorm.DB) *PortfolioRebalancesRepository {
	return &PortfolioRebalancesRepository{db: db}
}

func (r *PortfolioRebalancesRepository) CreateRun(
	run *models.PortfolioRebalanceRun,
) (*models.PortfolioRebalanceRun, error) {
	if run == nil {
		return nil, gorm.ErrInvalidData
	}
	fillRebalanceRunDefaults(run)

	if err := r.db.Create(run).Error; err != nil {
		return nil, err
	}
	return r.GetRunByID(run.UserID, run.PortfolioProfileID, run.ID)
}

func (r *PortfolioRebalancesRepository) CreateRunWithItems(
	run *models.PortfolioRebalanceRun,
	items []models.PortfolioRebalanceItem,
) (*models.PortfolioRebalanceRun, []models.PortfolioRebalanceItem, error) {
	if run == nil {
		return nil, nil, gorm.ErrInvalidData
	}
	fillRebalanceRunDefaults(run)

	for i := range items {
		if items[i].MetadataJSON == nil {
			items[i].MetadataJSON = datatypes.JSONMap{}
		}
	}

	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(run).Error; err != nil {
			return err
		}

		if len(items) == 0 {
			return nil
		}

		for i := range items {
			items[i].RebalanceRunID = run.ID
		}
		if err := tx.Create(&items).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	saved, err := r.GetRunByID(run.UserID, run.PortfolioProfileID, run.ID)
	if err != nil {
		return nil, nil, err
	}
	savedItems, err := r.ListItemsByRunID(run.ID)
	if err != nil {
		return nil, nil, err
	}
	return saved, savedItems, nil
}

func (r *PortfolioRebalancesRepository) ListRunsByPortfolio(userID int, portfolioProfileID int, limit int) ([]models.PortfolioRebalanceRun, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var rows []models.PortfolioRebalanceRun
	err := r.db.
		Where("user_id = ? AND portfolio_profile_id = ?", userID, portfolioProfileID).
		Order("created_at DESC, id DESC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

func (r *PortfolioRebalancesRepository) GetRunByID(userID int, portfolioProfileID int, runID int) (*models.PortfolioRebalanceRun, error) {
	var row models.PortfolioRebalanceRun
	err := r.db.
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *PortfolioRebalancesRepository) DeleteRunByID(userID int, portfolioProfileID int, runID int) error {
	result := r.db.
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		Delete(&models.PortfolioRebalanceRun{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *PortfolioRebalancesRepository) ListItemsByRunID(runID int) ([]models.PortfolioRebalanceItem, error) {
	var rows []models.PortfolioRebalanceItem
	err := r.db.
		Where("rebalance_run_id = ?", runID).
		Order("status ASC, ticker ASC, instrument_id ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *PortfolioRebalancesRepository) CreateExecutionLink(link *models.PortfolioRebalanceExecutionLink) error {
	if link == nil {
		return gorm.ErrInvalidData
	}
	if link.MetadataJSON == nil {
		link.MetadataJSON = datatypes.JSONMap{}
	}
	return r.db.Create(link).Error
}

func (r *PortfolioRebalancesRepository) ListExecutionLinksByRunID(runID int) ([]models.PortfolioRebalanceExecutionLink, error) {
	var rows []models.PortfolioRebalanceExecutionLink
	err := r.db.
		Where("rebalance_run_id = ?", runID).
		Order("created_at ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *PortfolioRebalancesRepository) CreateConfirmationRecord(record *models.PortfolioRebalanceConfirmationRecord) error {
	if record == nil {
		return gorm.ErrInvalidData
	}
	if record.PayloadJSON == nil {
		record.PayloadJSON = datatypes.JSONMap{}
	}
	return r.db.Create(record).Error
}

func (r *PortfolioRebalancesRepository) ListConfirmationRecordsByRunID(runID int) ([]models.PortfolioRebalanceConfirmationRecord, error) {
	var rows []models.PortfolioRebalanceConfirmationRecord
	err := r.db.
		Where("rebalance_run_id = ?", runID).
		Order("created_at ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *PortfolioRebalancesRepository) SetRunStatus(userID int, portfolioProfileID int, runID int, status string) error {
	result := r.db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		Updates(map[string]interface{}{
			"status": status,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *PortfolioRebalancesRepository) MarkRunExecutionStarted(userID int, portfolioProfileID int, runID int, startedAt time.Time) error {
	result := r.db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		Updates(map[string]interface{}{
			"status":     models.PortfolioRebalanceRunStatusExecuting,
			"started_at": startedAt.UTC(),
			"ended_at":   nil,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *PortfolioRebalancesRepository) MarkRunExecutionFinished(userID int, portfolioProfileID int, runID int, status string, endedAt time.Time) error {
	result := r.db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		Updates(map[string]interface{}{
			"status":   status,
			"ended_at": endedAt.UTC(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *PortfolioRebalancesRepository) UpdateItemStatus(runID int, itemID int, status string) error {
	result := r.db.Model(&models.PortfolioRebalanceItem{}).
		Where("id = ? AND rebalance_run_id = ?", itemID, runID).
		Updates(map[string]interface{}{
			"status": status,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func fillRebalanceRunDefaults(run *models.PortfolioRebalanceRun) {
	if run.ReplicationModeParamsSnapshot == nil {
		run.ReplicationModeParamsSnapshot = datatypes.JSONMap{}
	}
	if run.PlanningParamsSnapshot == nil {
		run.PlanningParamsSnapshot = datatypes.JSONMap{}
	}
	if run.InputJSON == nil {
		run.InputJSON = datatypes.JSONMap{}
	}
	if run.OutputJSON == nil {
		run.OutputJSON = datatypes.JSONMap{}
	}
	if run.SummaryJSON == nil {
		run.SummaryJSON = datatypes.JSONMap{}
	}
	if len(run.WarningsJSON) == 0 {
		run.WarningsJSON = datatypes.JSON([]byte("[]"))
	}
}
