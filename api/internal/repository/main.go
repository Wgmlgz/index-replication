package repository

import "gorm.io/gorm"

type RepositoryRegistry struct {
	AuditLogRepo                     *AuditLogRepository
	MarketPriceRepo                  *MarketPriceRepository
	MoexDataRepo                     *MoexDataRepository
	MoexSyncRepo                     *MoexSyncRepository
	PortfolioRebalancesRepo          *PortfolioRebalancesRepository
	PortfolioProfilesRepo            *PortfolioProfilesRepository
	PortfolioReplicationConfigsRepo  *PortfolioReplicationConfigsRepository
	VirtualPortfolioTransactionsRepo *VirtualPortfolioTransactionsRepository
	UserRepo                         *UserRepository
	UserSettingsRepo                 *UserSettingsRepository
	VerificationRepo                 *VerificationRepository
}

func NewRepositoryRegistry(db *gorm.DB) *RepositoryRegistry {
	return &RepositoryRegistry{
		AuditLogRepo:                     NewAuditLogRepository(db),
		MarketPriceRepo:                  NewMarketPriceRepository(db),
		MoexDataRepo:                     NewMoexDataRepository(db),
		MoexSyncRepo:                     NewMoexSyncRepository(db),
		PortfolioRebalancesRepo:          NewPortfolioRebalancesRepository(db),
		PortfolioProfilesRepo:            NewPortfolioProfilesRepository(db),
		PortfolioReplicationConfigsRepo:  NewPortfolioReplicationConfigsRepository(db),
		VirtualPortfolioTransactionsRepo: NewVirtualPortfolioTransactionsRepository(db),
		UserRepo:                         NewUserRepository(db),
		UserSettingsRepo:                 NewUserSettingsRepository(db),
		VerificationRepo:                 NewVerificationRepository(db),
	}
}
