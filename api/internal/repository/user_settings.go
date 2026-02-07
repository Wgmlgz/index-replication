package repository

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type UserSettingsRepository struct {
	db *gorm.DB
}

func NewUserSettingsRepository(db *gorm.DB) *UserSettingsRepository {
	return &UserSettingsRepository{db: db}
}

func (r *UserSettingsRepository) GetSettings(userID int) (map[string]string, error) {
	type row struct {
		Key   string
		Value string
	}
	var rows []row
	if err := r.db.Table("user_settings").
		Select("key, value").
		Where("user_id = ?", userID).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	settings := make(map[string]string, len(rows))
	for _, item := range rows {
		settings[item.Key] = item.Value
	}
	return settings, nil
}

func (r *UserSettingsRepository) UpsertSettings(userID int, values map[string]string) error {
	if len(values) == 0 {
		return nil
	}

	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	for key, value := range values {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if err := tx.Exec(`
			INSERT INTO user_settings (user_id, key, value, updated_at)
			VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			ON CONFLICT(user_id, key)
			DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
		`, userID, key, value).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("upsert setting %s: %w", key, err)
		}
	}

	return tx.Commit().Error
}

func (r *UserSettingsRepository) GetFavoriteIndexes(userID int) ([]string, error) {
	type row struct {
		SecID string `gorm:"column:secid"`
	}
	var rows []row
	if err := r.db.Table("user_favorite_indexes").
		Select("secid").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]string, 0, len(rows))
	for _, item := range rows {
		result = append(result, item.SecID)
	}
	return result, nil
}

func (r *UserSettingsRepository) ReplaceFavoriteIndexes(userID int, secids []string) error {
	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Exec("DELETE FROM user_favorite_indexes WHERE user_id = ?", userID).Error; err != nil {
		tx.Rollback()
		return err
	}

	for _, secid := range secids {
		if secid == "" {
			continue
		}
		if err := tx.Exec(`
			INSERT INTO user_favorite_indexes (user_id, secid, created_at)
			VALUES (?, ?, CURRENT_TIMESTAMP)
		`, userID, secid).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit().Error
}
