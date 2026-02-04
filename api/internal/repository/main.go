package repository

import "gorm.io/gorm"

type RepositoryRegistry struct {
	AuditLogRepo *AuditLogRepository
	UserRepo     *UserRepository
}

func NewRepositoryRegistry(db *gorm.DB) *RepositoryRegistry {
	return &RepositoryRegistry{
		AuditLogRepo: NewAuditLogRepository(db),
		UserRepo:     NewUserRepository(db),
	}
}
