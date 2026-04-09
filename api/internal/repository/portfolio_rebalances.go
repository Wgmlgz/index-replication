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

func (r *PortfolioRebalancesRepository) MarkRunExecutionStarted(userID int, portfolioProfileID int, runID int, startedAt time.Time) error {
	result := r.db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		Updates(map[string]interface{}{
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

func (r *PortfolioRebalancesRepository) MarkRunPlanningStarted(userID int, portfolioProfileID int, runID int, startedAt time.Time) error {
	result := r.db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		Updates(map[string]interface{}{
			"status":     models.PortfolioRebalanceRunStatusPlanning,
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

func (r *PortfolioRebalancesRepository) MarkRunPlanningFailed(userID int, portfolioProfileID int, runID int, endedAt time.Time) error {
	result := r.db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		Updates(map[string]interface{}{
			"status":   models.PortfolioRebalanceRunStatusPlanningFailed,
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

func (r *PortfolioRebalancesRepository) MarkRunPlanningFinished(
	userID int,
	portfolioProfileID int,
	runID int,
	run *models.PortfolioRebalanceRun,
	endedAt time.Time,
) error {
	if run == nil {
		return gorm.ErrInvalidData
	}
	fillRebalanceRunDefaults(run)

	updates := map[string]interface{}{
		"provider":                         run.Provider,
		"benchmark_secid_snapshot":         run.BenchmarkSecidSnapshot,
		"replication_mode_key_snapshot":    run.ReplicationModeKeySnapshot,
		"replication_mode_params_snapshot": run.ReplicationModeParamsSnapshot,
		"planning_params_snapshot":         run.PlanningParamsSnapshot,
		"status":                           models.PortfolioRebalanceRunStatusDraft,
		"as_of_date":                       run.AsOfDate.UTC(),
		"input_json":                       run.InputJSON,
		"output_json":                      run.OutputJSON,
		"summary_json":                     run.SummaryJSON,
		"warnings_json":                    run.WarningsJSON,
		"ended_at":                         endedAt.UTC(),
	}

	result := r.db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ? AND user_id = ? AND portfolio_profile_id = ?", runID, userID, portfolioProfileID).
		Updates(updates)
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
