package repository

import (
	"strings"
	"time"

	"server/internal/models"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PortfolioReplicationConfigsRepository struct {
	db *gorm.DB
}

func NewPortfolioReplicationConfigsRepository(db *gorm.DB) *PortfolioReplicationConfigsRepository {
	return &PortfolioReplicationConfigsRepository{db: db}
}

func (r *PortfolioReplicationConfigsRepository) ListByPortfolioProfileIDs(profileIDs []int) (map[int]models.PortfolioReplicationConfig, error) {
	normalized := uniquePositiveInts(profileIDs)
	if len(normalized) == 0 {
		return map[int]models.PortfolioReplicationConfig{}, nil
	}

	var rows []models.PortfolioReplicationConfig
	if err := r.db.Where("portfolio_profile_id IN ?", normalized).Find(&rows).Error; err != nil {
		return nil, err
	}

	result := make(map[int]models.PortfolioReplicationConfig, len(rows))
	for _, row := range rows {
		result[row.PortfolioProfileID] = row
	}
	return result, nil
}

func (r *PortfolioReplicationConfigsRepository) GetByPortfolioProfileID(profileID int) (*models.PortfolioReplicationConfig, error) {
	var row models.PortfolioReplicationConfig
	err := r.db.Where("portfolio_profile_id = ?", profileID).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *PortfolioReplicationConfigsRepository) Upsert(config *models.PortfolioReplicationConfig) (*models.PortfolioReplicationConfig, error) {
	if config == nil {
		return nil, gorm.ErrInvalidData
	}

	config.ModeKey = strings.TrimSpace(config.ModeKey)
	if config.ModeKey == "" {
		config.ModeKey = "full"
	}
	if config.ModeParams == nil {
		config.ModeParams = datatypes.JSONMap{}
	}

	now := time.Now().UTC()
	err := r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "portfolio_profile_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"is_enabled":      config.IsEnabled,
			"benchmark_secid": config.BenchmarkSecid,
			"mode_key":        config.ModeKey,
			"mode_params":     config.ModeParams,
			"updated_at":      now,
		}),
	}).Create(config).Error
	if err != nil {
		return nil, err
	}

	return r.GetByPortfolioProfileID(config.PortfolioProfileID)
}

func (r *PortfolioReplicationConfigsRepository) DeleteByPortfolioProfileID(profileID int) (bool, error) {
	tx := r.db.Where("portfolio_profile_id = ?", profileID).Delete(&models.PortfolioReplicationConfig{})
	if tx.Error != nil {
		return false, tx.Error
	}
	return tx.RowsAffected > 0, nil
}

func (r *PortfolioReplicationConfigsRepository) BenchmarkExists(secid string) (bool, error) {
	if secid == "" {
		return false, nil
	}

	var count int64
	if err := r.db.Table("moex_indexes").Where("secid = ?", secid).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func uniquePositiveInts(values []int) []int {
	if len(values) == 0 {
		return []int{}
	}
	seen := make(map[int]struct{}, len(values))
	result := make([]int, 0, len(values))
	for _, value := range values {
		if value <= 0 {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
