package repository

import (
	"errors"
	"time"

	"server/internal/models"

	"gorm.io/gorm"
)

type VerificationRepository struct {
	db *gorm.DB
}

func NewVerificationRepository(db *gorm.DB) *VerificationRepository {
	return &VerificationRepository{db: db}
}

func (r *VerificationRepository) CreateChallenge(challenge *models.VerificationChallenge) error {
	return r.db.Create(challenge).Error
}

func (r *VerificationRepository) GetChallengeByID(id string) (*models.VerificationChallenge, error) {
	var challenge models.VerificationChallenge
	if err := r.db.Where("id = ?", id).First(&challenge).Error; err != nil {
		return nil, err
	}
	return &challenge, nil
}

func (r *VerificationRepository) SaveChallenge(challenge *models.VerificationChallenge) error {
	return r.db.Save(challenge).Error
}

func (r *VerificationRepository) ExpirePendingChallenges(now time.Time, purpose string) error {
	query := r.db.Model(&models.VerificationChallenge{}).
		Where("status = ? AND expires_at <= ?", models.VerificationStatusPending, now)
	if purpose != "" {
		query = query.Where("purpose = ?", purpose)
	}
	return query.
		Updates(map[string]interface{}{
			"status":     models.VerificationStatusExpired,
			"updated_at": now,
		}).Error
}

func (r *VerificationRepository) CreateConnectToken(token *models.TelegramConnectToken) error {
	return r.db.Create(token).Error
}

func (r *VerificationRepository) ConsumeConnectToken(tokenValue string, now time.Time) (*models.TelegramConnectToken, error) {
	tx := r.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}

	var token models.TelegramConnectToken
	if err := tx.Where("token = ?", tokenValue).First(&token).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if token.ConsumedAt != nil {
		tx.Rollback()
		return nil, errors.New("token already consumed")
	}
	if now.After(token.ExpiresAt) {
		tx.Rollback()
		return nil, errors.New("token expired")
	}

	token.ConsumedAt = &now
	if err := tx.Save(&token).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return &token, nil
}
