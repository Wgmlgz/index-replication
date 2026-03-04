package repository

import "gorm.io/gorm"

type RepositoryRegistry struct {
	AuditLogRepo                     *AuditLogRepository
	MoexDataRepo                     *MoexDataRepository
	MoexSyncRepo                     *MoexSyncRepository
	PortfolioProfilesRepo            *PortfolioProfilesRepository
	VirtualPortfolioTransactionsRepo *VirtualPortfolioTransactionsRepository
	UserRepo                         *UserRepository
	UserSettingsRepo                 *UserSettingsRepository
	VerificationRepo                 *VerificationRepository
}

func NewRepositoryRegistry(db *gorm.DB) *RepositoryRegistry {
	return &RepositoryRegistry{
		AuditLogRepo:                     NewAuditLogRepository(db),
		MoexDataRepo:                     NewMoexDataRepository(db),
		MoexSyncRepo:                     NewMoexSyncRepository(db),
		PortfolioProfilesRepo:            NewPortfolioProfilesRepository(db),
		VirtualPortfolioTransactionsRepo: NewVirtualPortfolioTransactionsRepository(db),
		UserRepo:                         NewUserRepository(db),
		UserSettingsRepo:                 NewUserSettingsRepository(db),
		VerificationRepo:                 NewVerificationRepository(db),
	}
}
