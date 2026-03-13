package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/moex"
	moexdomain "server/internal/moex/domain"
	"server/internal/portfolio"
	"server/internal/rebalance"
	rebalanceplanner "server/internal/rebalance/planner"
	"server/internal/repository"
	"server/internal/services"
	"server/internal/testutil"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func TestPortfolioRebalanceAPI_CreateDraftSuccess(t *testing.T) {
	router, _, profileID := setupRebalanceTestRouter(t, true)

	payload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
		PlanningParams: map[string]interface{}{
			"quantity_precision": 4,
		},
	}

	rec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), payload)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d, body=%s", rec.Code, rec.Body.String())
	}

	var resp dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Run.ID <= 0 {
		t.Fatalf("expected run id > 0")
	}
	if resp.Run.Status != models.PortfolioRebalanceRunStatusDraft {
		t.Fatalf("expected draft status, got %q", resp.Run.Status)
	}
	if resp.Run.ModeKey != "full" {
		t.Fatalf("expected mode full, got %q", resp.Run.ModeKey)
	}
	if len(resp.Items) == 0 {
		t.Fatalf("expected planned items")
	}
}

func TestPortfolioRebalanceAPI_InvalidProfileOrConfig(t *testing.T) {
	router, db, _ := setupRebalanceTestRouter(t, false)

	payload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
	}

	t.Run("missing profile", func(t *testing.T) {
		rec := performJSONRequest(t, router, http.MethodPost,
			"/me/portfolios/99999/rebalances", payload)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected status 404, got %d", rec.Code)
		}
	})

	t.Run("missing replication config", func(t *testing.T) {
		profileID := createPortfolioProfileRow(t, db, 501)
		rec := performJSONRequest(t, router, http.MethodPost,
			fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), payload)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected status 404, got %d, body=%s", rec.Code, rec.Body.String())
		}
	})
}

func TestPortfolioRebalanceAPI_DetailAndListContract(t *testing.T) {
	router, _, profileID := setupRebalanceTestRouter(t, true)

	createPayload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "automatic",
		AsOfDate:      "2025-01-15",
	}

	createRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), createPayload)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var created dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	listRec := performJSONRequest(t, router, http.MethodGet,
		fmt.Sprintf("/me/portfolios/%d/rebalances?limit=10", profileID), nil)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected list status 200, got %d", listRec.Code)
	}

	var listResp []dto.PortfolioRebalanceRun
	if err := json.Unmarshal(listRec.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(listResp) == 0 {
		t.Fatalf("expected non-empty list")
	}
	if listResp[0].AsOfDate == "" || listResp[0].ExecutionMode == "" {
		t.Fatalf("expected list contract fields to be filled: %+v", listResp[0])
	}

	detailRec := performJSONRequest(t, router, http.MethodGet,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d", profileID, created.Run.ID), nil)
	if detailRec.Code != http.StatusOK {
		t.Fatalf("expected detail status 200, got %d", detailRec.Code)
	}

	var detailResp dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(detailRec.Body.Bytes(), &detailResp); err != nil {
		t.Fatalf("decode detail response: %v", err)
	}
	if detailResp.Run.ID != created.Run.ID {
		t.Fatalf("expected detail run id %d, got %d", created.Run.ID, detailResp.Run.ID)
	}
	if len(detailResp.Items) == 0 {
		t.Fatalf("expected detail items")
	}
}

func TestPortfolioRebalanceAPI_DeleteDraft(t *testing.T) {
	router, _, profileID := setupRebalanceTestRouter(t, true)

	createPayload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
	}
	createRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), createPayload)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var created dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if created.Run.ID <= 0 {
		t.Fatalf("expected created run id > 0")
	}

	deleteRec := performJSONRequest(t, router, http.MethodDelete,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d", profileID, created.Run.ID), nil)
	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d body=%s", deleteRec.Code, deleteRec.Body.String())
	}

	detailRec := performJSONRequest(t, router, http.MethodGet,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d", profileID, created.Run.ID), nil)
	if detailRec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d body=%s", detailRec.Code, detailRec.Body.String())
	}

	deleteMissingRec := performJSONRequest(t, router, http.MethodDelete,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d", profileID, created.Run.ID), nil)
	if deleteMissingRec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d body=%s", deleteMissingRec.Code, deleteMissingRec.Body.String())
	}
}

func setupRebalanceTestRouter(t *testing.T, withReplication bool) (*gin.Engine, *gorm.DB, int) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, cleanup := testutil.NewTestDB(t)
	t.Cleanup(cleanup)

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		t.Fatalf("enable sqlite foreign keys: %v", err)
	}

	profileID := createPortfolioProfileRow(t, db, 500)
	if withReplication {
		insertReplicationConfig(t, db, profileID, "IMOEX")
	}
	seedBenchmarkIndex(t, db, "IMOEX")

	profilesRepo := repository.NewPortfolioProfilesRepository(db)
	replicationRepo := repository.NewPortfolioReplicationConfigsRepository(db)
	runsRepo := repository.NewPortfolioRebalancesRepository(db)
	benchmarkRead := &fakeBenchmarkReadService{
		rows: []moexdomain.IndexCompositionEntry{
			{IndexID: "IMOEX", TradeDate: "2025-01-15", Ticker: "MOCKA", SecID: "MOCKA", Weight: floatPtr(50)},
			{IndexID: "IMOEX", TradeDate: "2025-01-15", Ticker: "MOCKB", SecID: "MOCKB", Weight: floatPtr(30)},
			{IndexID: "IMOEX", TradeDate: "2025-01-15", Ticker: "MOCKC", SecID: "MOCKC", Weight: floatPtr(20)},
		},
	}

	mockProvider := portfolio.NewMockProvider()
	snapshotLoader := rebalance.NewSnapshotLoader(
		profilesRepo,
		replicationRepo,
		benchmarkRead,
		mockProvider,
	)
	plannerService := rebalanceplanner.NewService(
		rebalanceplanner.NewRegistry(
			rebalanceplanner.NewFullAlgorithm(),
			rebalanceplanner.NewSampledAlgorithm(),
		),
	)

	service := rebalance.NewService(
		profilesRepo,
		runsRepo,
		snapshotLoader,
		plannerService,
		services.NewAuditService(db),
	)
	handler := NewPortfolioRebalanceHandler(service)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(utils.CustomContextKey, &utils.RequestContext{UserID: 500, RoleKey: "admin"})
		c.Next()
	})
	router.POST("/me/portfolios/:id/rebalances", handler.CreateRebalanceDraft)
	router.GET("/me/portfolios/:id/rebalances", handler.ListRebalances)
	router.GET("/me/portfolios/:id/rebalances/:rebalanceId", handler.GetRebalanceDetail)
	router.DELETE("/me/portfolios/:id/rebalances/:rebalanceId", handler.DeleteRebalanceDraft)

	return router, db, profileID
}

func seedBenchmarkIndex(t *testing.T, db *gorm.DB, benchmarkSecid string) {
	t.Helper()
	if err := db.Create(&models.MoexIndexDB{
		Secid:     benchmarkSecid,
		ShortName: benchmarkSecid,
		Name:      benchmarkSecid + " index",
	}).Error; err != nil {
		t.Fatalf("seed benchmark index: %v", err)
	}
}

func createPortfolioProfileRow(t *testing.T, db *gorm.DB, userID int) int {
	t.Helper()
	row := &models.PortfolioProfile{
		UserID:     userID,
		Provider:   "mock",
		Name:       "API test profile",
		IsDefault:  true,
		ConfigJSON: "{}",
		SecretJSON: "{}",
	}
	if err := db.Create(row).Error; err != nil {
		t.Fatalf("create profile: %v", err)
	}
	return row.ID
}

func insertReplicationConfig(t *testing.T, db *gorm.DB, profileID int, benchmarkSecid string) {
	t.Helper()
	if err := db.Create(&models.PortfolioReplicationConfig{
		PortfolioProfileID: profileID,
		IsEnabled:          true,
		BenchmarkSecid:     &benchmarkSecid,
		ModeKey:            "full",
		ModeParams:         datatypes.JSONMap{},
	}).Error; err != nil {
		t.Fatalf("create replication config: %v", err)
	}
}

func performJSONRequest(t *testing.T, router *gin.Engine, method string, url string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()

	var body []byte
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("encode payload: %v", err)
		}
		body = encoded
	}

	req := httptest.NewRequest(method, url, bytes.NewReader(body))
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func floatPtr(value float64) *float64 {
	return &value
}

type fakeBenchmarkReadService struct {
	rows []moexdomain.IndexCompositionEntry
}

func (s *fakeBenchmarkReadService) GetIndexComposition(_ context.Context, _ string, _ string, _ string) ([]moexdomain.IndexCompositionEntry, *moex.MoexCoverageMeta, error) {
	rows := make([]moexdomain.IndexCompositionEntry, 0, len(s.rows))
	rows = append(rows, s.rows...)
	return rows, nil, nil
}
