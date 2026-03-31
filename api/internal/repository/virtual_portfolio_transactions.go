package repository

import (
	"server/internal/models"

	"gorm.io/gorm"
)

type VirtualPortfolioTransactionsRepository struct {
	db *gorm.DB
}

func NewVirtualPortfolioTransactionsRepository(db *gorm.DB) *VirtualPortfolioTransactionsRepository {
	return &VirtualPortfolioTransactionsRepository{db: db}
}

func (r *VirtualPortfolioTransactionsRepository) Create(txn *models.VirtualPortfolioTransaction) error {
	return r.db.Create(txn).Error
}

func (r *VirtualPortfolioTransactionsRepository) GetByActionID(userID int, profileID int, actionID string) (*models.VirtualPortfolioTransaction, error) {
	var row models.VirtualPortfolioTransaction
	err := r.db.
		Where("user_id = ? AND portfolio_profile_id = ? AND action_id = ?", userID, profileID, actionID).
		First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *VirtualPortfolioTransactionsRepository) ListByProfile(userID int, profileID int) ([]models.VirtualPortfolioTransaction, error) {
	var rows []models.VirtualPortfolioTransaction
	err := r.db.
		Where("user_id = ? AND portfolio_profile_id = ?", userID, profileID).
		Order("executed_at ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *VirtualPortfolioTransactionsRepository) CountByProfile(userID int, profileID int) (int64, error) {
	var count int64
	err := r.db.
		Model(&models.VirtualPortfolioTransaction{}).
		Where("user_id = ? AND portfolio_profile_id = ?", userID, profileID).
		Count(&count).Error
	return count, err
}

func (r *VirtualPortfolioTransactionsRepository) ListByProfilePaged(userID int, profileID int, offset int, limit int) ([]models.VirtualPortfolioTransaction, error) {
	var rows []models.VirtualPortfolioTransaction
	err := r.db.
		Where("user_id = ? AND portfolio_profile_id = ?", userID, profileID).
		Order("executed_at DESC, id DESC").
		Offset(offset).
		Limit(limit).
		Find(&rows).Error
	return rows, err
}
