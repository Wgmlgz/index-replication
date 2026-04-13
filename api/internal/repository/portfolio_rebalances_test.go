package repository

import (
	"errors"
	"testing"
	"time"

	"server/internal/models"
	"server/internal/testutil"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func TestPortfolioRebalances_MigrationsCreateTables(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	tableNames := []string{
		"portfolio_rebalance_runs",
	}

	for _, tableName := range tableNames {
		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?", tableName).Scan(&count).Error; err != nil {
			t.Fatalf("check table %s exists: %v", tableName, err)
		}
		if count != 1 {
			t.Fatalf("expected table %s to exist", tableName)
		}
	}
}

func TestPortfolioRebalancesRepository_CreateAndRead(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	profileID := createPortfolioProfileForRebalance(t, db, 101)
	repo := NewPortfolioRebalancesRepository(db)

	asOfDate, err := time.Parse("2006-01-02", "2025-01-15")
	if err != nil {
		t.Fatalf("parse as-of date: %v", err)
	}
	benchmark := "IMOEX"

	run, err := repo.CreateRun(
		&models.PortfolioRebalanceRun{
			UserID:                        101,
			PortfolioProfileID:            profileID,
			Provider:                      "virtual",
			BenchmarkSecidSnapshot:        &benchmark,
			ReplicationModeKeySnapshot:    "full",
			ReplicationModeParamsSnapshot: datatypes.JSONMap{"mode": "full"},
			PlanningParamsSnapshot:        datatypes.JSONMap{"quantity_precision": 6.0},
			ExecutionMode:                 models.PortfolioRebalanceExecutionModeManual,
			ConfirmationRequired:          true,
			Status:                        models.PortfolioRebalanceRunStatusDraft,
			AsOfDate:                      asOfDate,
			InputJSON:                     datatypes.JSONMap{"mode_key": "full"},
			OutputJSON:                    datatypes.JSONMap{"warnings": []string{"missing_reference_price"}},
			SummaryJSON:                   datatypes.JSONMap{"items_total": 2.0, "unresolved_items": 1.0},
		},
	)
	if err != nil {
		t.Fatalf("create run: %v", err)
	}
	if run.ID <= 0 {
		t.Fatalf("expected run id > 0")
	}
	if run.InputJSON["mode_key"] != "full" {
		t.Fatalf("expected input json payload")
	}

	list, err := repo.ListRunsByPortfolio(101, profileID, 10)
	if err != nil {
		t.Fatalf("list runs: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 run in list, got %d", len(list))
	}

	detail, err := repo.GetRunByID(101, profileID, run.ID)
	if err != nil {
		t.Fatalf("get run by id: %v", err)
	}
	if detail.ExecutionMode != models.PortfolioRebalanceExecutionModeManual {
		t.Fatalf("unexpected execution mode: %s", detail.ExecutionMode)
	}

}

func TestPortfolioRebalancesRepository_CascadeDelete(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	profileID := createPortfolioProfileForRebalance(t, db, 102)
	repo := NewPortfolioRebalancesRepository(db)

	asOfDate, err := time.Parse("2006-01-02", "2025-02-01")
	if err != nil {
		t.Fatalf("parse as-of date: %v", err)
	}

	run, err := repo.CreateRun(
		&models.PortfolioRebalanceRun{
			UserID:                     102,
			PortfolioProfileID:         profileID,
			Provider:                   "virtual",
			ReplicationModeKeySnapshot: "full",
			ExecutionMode:              models.PortfolioRebalanceExecutionModeManual,
			ConfirmationRequired:       true,
			Status:                     models.PortfolioRebalanceRunStatusDraft,
			AsOfDate:                   asOfDate,
			InputJSON:                  datatypes.JSONMap{"mode_key": "full"},
			OutputJSON:                 datatypes.JSONMap{"warnings": []string{}},
			SummaryJSON:                datatypes.JSONMap{},
		},
	)
	if err != nil {
		t.Fatalf("create run: %v", err)
	}

	if err := repo.DeleteRunByID(102, profileID, run.ID); err != nil {
		t.Fatalf("delete rebalance run: %v", err)
	}

	if err := repo.DeleteRunByID(102, profileID, run.ID); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected gorm.ErrRecordNotFound, got %v", err)
	}
}

func createPortfolioProfileForRebalance(t *testing.T, db *gorm.DB, userID int) int {
	t.Helper()
	profile := &models.PortfolioProfile{
		UserID:     userID,
		Provider:   "virtual",
		Name:       "Rebalance test profile",
		ConfigJSON: "{}",
		SecretJSON: "{}",
	}
	if err := db.Create(profile).Error; err != nil {
		t.Fatalf("create profile: %v", err)
	}
	return profile.ID
}
