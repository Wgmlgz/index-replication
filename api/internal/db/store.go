package db

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Store struct {
	db *gorm.DB
}

type User struct {
	ID           int64     `gorm:"primaryKey"`
	Email        string    `gorm:"uniqueIndex;not null"`
	PasswordHash string    `gorm:"not null"`
	CreatedAt    time.Time `gorm:"not null;default:now()"`
}

type RefreshToken struct {
	ID        int64     `gorm:"primaryKey"`
	UserID    int64     `gorm:"index;not null"`
	TokenHash string    `gorm:"uniqueIndex;not null"`
	ExpiresAt time.Time `gorm:"index;not null"`
	CreatedAt time.Time `gorm:"not null;default:now()"`
}

func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (s *Store) CreateUser(ctx context.Context, email, passwordHash string) (User, error) {
	user := User{Email: email, PasswordHash: passwordHash}
	err := s.db.WithContext(ctx).Create(&user).Error
	return user, err
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (User, error) {
	var user User
	err := s.db.WithContext(ctx).Where("email = ?", email).First(&user).Error
	return user, err
}

func (s *Store) GetUserByID(ctx context.Context, id int64) (User, error) {
	var user User
	err := s.db.WithContext(ctx).First(&user, id).Error
	return user, err
}

func (s *Store) SaveRefreshToken(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	token := RefreshToken{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
	}
	return s.db.WithContext(ctx).Create(&token).Error
}

func (s *Store) GetRefreshToken(ctx context.Context, tokenHash string) (RefreshToken, error) {
	var token RefreshToken
	err := s.db.WithContext(ctx).Where("token_hash = ?", tokenHash).First(&token).Error
	return token, err
}

func (s *Store) DeleteRefreshToken(ctx context.Context, tokenHash string) error {
	return s.db.WithContext(ctx).Where("token_hash = ?", tokenHash).Delete(&RefreshToken{}).Error
}
