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

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable sqlite foreign keys: %v", err)
	}

	tableNames := []string{
		"portfolio_rebalance_runs",
		"portfolio_rebalance_items",
		"portfolio_rebalance_execution_links",
		"portfolio_rebalance_confirmation_records",
	}

	for _, tableName := range tableNames {
		var count int64
		if err := db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?", tableName).Scan(&count).Error; err != nil {
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

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable sqlite foreign keys: %v", err)
	}

	profileID := createPortfolioProfileForRebalance(t, db, 101)
	repo := NewPortfolioRebalancesRepository(db)

	asOfDate, err := time.Parse("2006-01-02", "2025-01-15")
	if err != nil {
		t.Fatalf("parse as-of date: %v", err)
	}
	benchmark := "IMOEX"

	run, items, err := repo.CreateRunWithItems(
		&models.PortfolioRebalanceRun{
			UserID:                        101,
			PortfolioProfileID:            profileID,
			Provider:                      "virtual",
			BenchmarkSecidSnapshot:        &benchmark,
			ReplicationModeKeySnapshot:    "full",
			ReplicationModeParamsSnapshot: datatypes.JSONMap{"mode": "full"},
			PlanningParamsSnapshot:        datatypes.JSONMap{"include_zero_deltas": false},
			ExecutionMode:                 models.PortfolioRebalanceExecutionModeManual,
			ConfirmationRequired:          true,
			Status:                        models.PortfolioRebalanceRunStatusDraft,
			AsOfDate:                      asOfDate,
			SummaryJSON:                   datatypes.JSONMap{"items_total": 2.0, "unresolved_items": 1.0},
			WarningsJSON:                  datatypes.JSON([]byte(`["missing reference price"]`)),
		},
		[]models.PortfolioRebalanceItem{
			{
				Ticker:          "MOCKA",
				InstrumentID:    "MOCKA",
				Side:            models.PortfolioRebalanceItemSideBuy,
				CurrentQuantity: 10,
				TargetQuantity:  12,
				DeltaQuantity:   2,
				CurrentWeight:   45,
				TargetWeight:    55,
				ReferencePrice:  ptrFloat(100),
				PlannedAmount:   ptrFloat(200),
				Status:          models.PortfolioRebalanceItemStatusPlanned,
				MetadataJSON:    datatypes.JSONMap{},
			},
			{
				Ticker:          "MOCKB",
				InstrumentID:    "MOCKB",
				Side:            models.PortfolioRebalanceItemSideBuy,
				CurrentQuantity: 0,
				TargetQuantity:  0,
				DeltaQuantity:   0,
				CurrentWeight:   0,
				TargetWeight:    12,
				Status:          models.PortfolioRebalanceItemStatusUnresolved,
				MetadataJSON:    datatypes.JSONMap{"reason": "missing_reference_price"},
			},
		},
	)
	if err != nil {
		t.Fatalf("create run with items: %v", err)
	}
	if run.ID <= 0 {
		t.Fatalf("expected run id > 0")
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	if items[0].ID <= 0 || items[1].ID <= 0 {
		t.Fatalf("expected item ids to be assigned")
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

	detailItems, err := repo.ListItemsByRunID(run.ID)
	if err != nil {
		t.Fatalf("list items by run id: %v", err)
	}
	if len(detailItems) != 2 {
		t.Fatalf("expected 2 detail items, got %d", len(detailItems))
	}
	if detailItems[1].Status != models.PortfolioRebalanceItemStatusUnresolved {
		t.Fatalf("expected unresolved item, got %q", detailItems[1].Status)
	}
}

func TestPortfolioRebalancesRepository_CascadeDelete(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable sqlite foreign keys: %v", err)
	}

	profileID := createPortfolioProfileForRebalance(t, db, 102)
	repo := NewPortfolioRebalancesRepository(db)

	asOfDate, err := time.Parse("2006-01-02", "2025-02-01")
	if err != nil {
		t.Fatalf("parse as-of date: %v", err)
	}

	run, items, err := repo.CreateRunWithItems(
		&models.PortfolioRebalanceRun{
			UserID:                     102,
			PortfolioProfileID:         profileID,
			Provider:                   "virtual",
			ReplicationModeKeySnapshot: "full",
			ExecutionMode:              models.PortfolioRebalanceExecutionModeManual,
			ConfirmationRequired:       true,
			Status:                     models.PortfolioRebalanceRunStatusDraft,
			AsOfDate:                   asOfDate,
			WarningsJSON:               datatypes.JSON([]byte("[]")),
		},
		[]models.PortfolioRebalanceItem{{
			Ticker:          "MOCKA",
			InstrumentID:    "MOCKA",
			Side:            models.PortfolioRebalanceItemSideSell,
			CurrentQuantity: 5,
			TargetQuantity:  0,
			DeltaQuantity:   -5,
			Status:          models.PortfolioRebalanceItemStatusPlanned,
		}},
	)
	if err != nil {
		t.Fatalf("create run with items: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item")
	}

	if err := repo.CreateExecutionLink(&models.PortfolioRebalanceExecutionLink{
		RebalanceRunID:  run.ID,
		RebalanceItemID: &items[0].ID,
		Status:          "pending",
		MetadataJSON:    datatypes.JSONMap{},
	}); err != nil {
		t.Fatalf("insert execution link: %v", err)
	}
	if err := repo.CreateConfirmationRecord(&models.PortfolioRebalanceConfirmationRecord{
		RebalanceRunID:   run.ID,
		ConfirmationType: "initial",
		Status:           "pending",
		PayloadJSON:      datatypes.JSONMap{},
	}); err != nil {
		t.Fatalf("insert confirmation record: %v", err)
	}

	if err := repo.DeleteRunByID(102, profileID, run.ID); err != nil {
		t.Fatalf("delete rebalance run: %v", err)
	}

	assertCount(t, db, "portfolio_rebalance_items", "rebalance_run_id = ?", run.ID, 0)
	assertCount(t, db, "portfolio_rebalance_execution_links", "rebalance_run_id = ?", run.ID, 0)
	assertCount(t, db, "portfolio_rebalance_confirmation_records", "rebalance_run_id = ?", run.ID, 0)

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

func assertCount(t *testing.T, db *gorm.DB, table string, where string, arg any, expected int64) {
	t.Helper()
	var count int64
	if err := db.Table(table).Where(where, arg).Count(&count).Error; err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	if count != expected {
		t.Fatalf("expected %d rows in %s, got %d", expected, table, count)
	}
}

func ptrFloat(value float64) *float64 {
	return &value
}
