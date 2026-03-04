package repository

import (
	"server/internal/models"
	"strings"

	"gorm.io/gorm"
)

type PortfolioProfilesRepository struct {
	db *gorm.DB
}

func NewPortfolioProfilesRepository(db *gorm.DB) *PortfolioProfilesRepository {
	return &PortfolioProfilesRepository{db: db}
}

func (r *PortfolioProfilesRepository) ListByUser(userID int) ([]models.PortfolioProfile, error) {
	var profiles []models.PortfolioProfile
	err := r.db.
		Where("user_id = ?", userID).
		Order("is_default DESC, updated_at DESC, id DESC").
		Find(&profiles).Error
	return profiles, err
}

func (r *PortfolioProfilesRepository) GetByID(userID int, id int) (*models.PortfolioProfile, error) {
	var profile models.PortfolioProfile
	err := r.db.Where("user_id = ? AND id = ?", userID, id).First(&profile).Error
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (r *PortfolioProfilesRepository) Create(profile *models.PortfolioProfile) error {
	return r.db.Create(profile).Error
}

func (r *PortfolioProfilesRepository) Update(profile *models.PortfolioProfile) error {
	return r.db.Save(profile).Error
}

func (r *PortfolioProfilesRepository) Delete(userID int, id int) (bool, error) {
	tx := r.db.Where("user_id = ? AND id = ?", userID, id).Delete(&models.PortfolioProfile{})
	if tx.Error != nil {
		return false, tx.Error
	}
	return tx.RowsAffected > 0, nil
}

func (r *PortfolioProfilesRepository) SetDefault(userID int, id int) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.PortfolioProfile{}).
			Where("user_id = ?", userID).
			Update("is_default", false).Error; err != nil {
			return err
		}

		res := tx.Model(&models.PortfolioProfile{}).
			Where("user_id = ? AND id = ?", userID, id).
			Update("is_default", true)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *PortfolioProfilesRepository) CountByUser(userID int) (int64, error) {
	var count int64
	err := r.db.Model(&models.PortfolioProfile{}).
		Where("user_id = ?", userID).
		Count(&count).Error
	return count, err
}

func (r *PortfolioProfilesRepository) EnsureSingleDefault(userID int) error {
	profiles, err := r.ListByUser(userID)
	if err != nil {
		return err
	}
	if len(profiles) == 0 {
		return nil
	}

	defaultID := 0
	for _, profile := range profiles {
		if profile.IsDefault {
			defaultID = profile.ID
			break
		}
	}
	if defaultID != 0 {
		return nil
	}
	return r.SetDefault(userID, profiles[0].ID)
}

func NormalizeProvider(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
