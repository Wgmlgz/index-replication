package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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
	"server/internal/workflows"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func TestPortfolioRebalanceAPI_CreateDraftSuccess(t *testing.T) {
	starter := &fakeRebalanceExecutionStarter{}
	router, _, profileID := setupRebalanceTestRouterWithStarter(t, true, starter)

	payload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
		PlanningParams: map[string]interface{}{
			"quantity_precision": 4,
		},
	}

	rec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), payload)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d, body=%s", rec.Code, rec.Body.String())
	}

	var resp dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Run.ID <= 0 {
		t.Fatalf("expected run id > 0")
	}
	if resp.Run.Status != models.PortfolioRebalanceRunStatusPlanningQueued {
		t.Fatalf("expected planning_queued status, got %q", resp.Run.Status)
	}
	if resp.Run.ModeKey != "full" {
		t.Fatalf("expected mode full, got %q", resp.Run.ModeKey)
	}
	if starter.planningCalls != 1 {
		t.Fatalf("expected planning starter to be called once, got %d", starter.planningCalls)
	}
	if starter.calls != 0 {
		t.Fatalf("expected execution starter not to be called during draft creation, got %d", starter.calls)
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
	if createRec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d, body=%s", createRec.Code, createRec.Body.String())
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
}

func TestPortfolioRebalanceAPI_DeleteDraft(t *testing.T) {
	router, _, profileID := setupRebalanceTestRouter(t, true)

	createPayload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
	}
	createRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), createPayload)
	if createRec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d, body=%s", createRec.Code, createRec.Body.String())
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

func TestPortfolioRebalanceAPI_ExecuteDraft(t *testing.T) {
	starter := &fakeRebalanceExecutionStarter{}
	router, db, profileID := setupRebalanceTestRouterWithStarter(t, true, starter)

	createPayload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "automatic",
		AsOfDate:      "2025-01-15",
	}
	createRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), createPayload)
	if createRec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var created dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if err := db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ?", created.Run.ID).
		Update("status", models.PortfolioRebalanceRunStatusDraft).Error; err != nil {
		t.Fatalf("update run status to draft: %v", err)
	}

	executeRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d/execute", profileID, created.Run.ID), nil)
	if executeRec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d body=%s", executeRec.Code, executeRec.Body.String())
	}
	if starter.calls != 1 {
		t.Fatalf("expected execution starter to be called once, got %d", starter.calls)
	}
	if starter.runID != created.Run.ID {
		t.Fatalf("expected starter run id %d, got %d", created.Run.ID, starter.runID)
	}
}

func TestPortfolioRebalanceAPI_GetStatus(t *testing.T) {
	starter := &fakeRebalanceExecutionStarter{}
	router, db, profileID := setupRebalanceTestRouterWithStarter(t, true, starter)

	createPayload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
	}
	createRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), createPayload)
	if createRec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var created dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	if err := db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ?", created.Run.ID).
		Update("status", models.PortfolioRebalanceRunStatusExecuting).Error; err != nil {
		t.Fatalf("update run status: %v", err)
	}

	executionRec := performJSONRequest(t, router, http.MethodGet,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d/status", profileID, created.Run.ID), nil)
	if executionRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", executionRec.Code, executionRec.Body.String())
	}

	var executionResp dto.PortfolioRebalanceStatusResponse
	if err := json.Unmarshal(executionRec.Body.Bytes(), &executionResp); err != nil {
		t.Fatalf("decode execution response: %v", err)
	}
	if executionResp.Run.ID != created.Run.ID {
		t.Fatalf("expected run id %d, got %d", created.Run.ID, executionResp.Run.ID)
	}
	if executionResp.Run.Status != models.PortfolioRebalanceRunStatusExecuting {
		t.Fatalf("expected run status %q, got %q", models.PortfolioRebalanceRunStatusExecuting, executionResp.Run.Status)
	}
	if executionResp.Progress.TotalItems == 0 {
		t.Fatalf("expected progress total_items > 0")
	}
	if executionResp.Progress.StageCode == "" {
		t.Fatalf("expected non-empty execution stage_code")
	}
	if executionResp.Progress.StageMessage == "" {
		t.Fatalf("expected non-empty execution stage_message")
	}
	if len(executionResp.Items) == 0 {
		t.Fatalf("expected execution items")
	}
}

func TestPortfolioRebalanceAPI_GetStatusWhilePlanning(t *testing.T) {
	starter := &fakeRebalanceExecutionStarter{}
	router, _, profileID := setupRebalanceTestRouterWithStarter(t, true, starter)

	createPayload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
	}
	createRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), createPayload)
	if createRec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var created dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	executionRec := performJSONRequest(t, router, http.MethodGet,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d/status", profileID, created.Run.ID), nil)
	if executionRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", executionRec.Code, executionRec.Body.String())
	}

	var executionResp dto.PortfolioRebalanceStatusResponse
	if err := json.Unmarshal(executionRec.Body.Bytes(), &executionResp); err != nil {
		t.Fatalf("decode execution response: %v", err)
	}
	if executionResp.Run.Status != models.PortfolioRebalanceRunStatusPlanningQueued {
		t.Fatalf("expected run status %q, got %q", models.PortfolioRebalanceRunStatusPlanningQueued, executionResp.Run.Status)
	}
	if executionResp.Progress.CompletionPercent != 0 {
		t.Fatalf("expected completion 0, got %.2f", executionResp.Progress.CompletionPercent)
	}
	if executionResp.Progress.StageCode != "planning_queued" {
		t.Fatalf("expected stage_code %q, got %q", "planning_queued", executionResp.Progress.StageCode)
	}
	if executionResp.Progress.IsTerminal {
		t.Fatalf("expected non-terminal progress")
	}
	if len(executionResp.Items) != 0 || len(executionResp.Links) != 0 {
		t.Fatalf("expected no execution items/links while planning")
	}
}

func TestPortfolioRebalanceAPI_GetStatusAfterPlanning(t *testing.T) {
	starter := &fakeRebalanceExecutionStarter{}
	router, db, profileID := setupRebalanceTestRouterWithStarter(t, true, starter)

	createPayload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
	}
	createRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), createPayload)
	if createRec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var created dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	endedAt := time.Now().UTC()
	if err := db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ?", created.Run.ID).
		Updates(map[string]interface{}{
			"status":   models.PortfolioRebalanceRunStatusDraft,
			"ended_at": endedAt,
		}).Error; err != nil {
		t.Fatalf("update run status: %v", err)
	}

	executionRec := performJSONRequest(t, router, http.MethodGet,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d/status", profileID, created.Run.ID), nil)
	if executionRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", executionRec.Code, executionRec.Body.String())
	}

	var executionResp dto.PortfolioRebalanceStatusResponse
	if err := json.Unmarshal(executionRec.Body.Bytes(), &executionResp); err != nil {
		t.Fatalf("decode execution response: %v", err)
	}
	if executionResp.Run.Status != models.PortfolioRebalanceRunStatusDraft {
		t.Fatalf("expected run status %q, got %q", models.PortfolioRebalanceRunStatusDraft, executionResp.Run.Status)
	}
	if executionResp.Progress.CompletionPercent != 100 {
		t.Fatalf("expected completion 100, got %.2f", executionResp.Progress.CompletionPercent)
	}
	if executionResp.Progress.StageCode != "planning_completed" {
		t.Fatalf("expected stage_code %q, got %q", "planning_completed", executionResp.Progress.StageCode)
	}
	if !executionResp.Progress.IsTerminal {
		t.Fatalf("expected terminal progress for draft status")
	}
}

func TestPortfolioRebalanceAPI_GetStatusReconcilesPlanningFailureFromTemporal(t *testing.T) {
	starter := &fakeRebalanceExecutionStarter{}
	router, db, profileID := setupRebalanceTestRouterWithStarter(t, true, starter)

	createPayload := dto.PortfolioRebalanceCreateRequest{
		ExecutionMode: "manual",
		AsOfDate:      "2025-01-15",
	}
	createRec := performJSONRequest(t, router, http.MethodPost,
		fmt.Sprintf("/me/portfolios/%d/rebalances", profileID), createPayload)
	if createRec.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d, body=%s", createRec.Code, createRec.Body.String())
	}

	var created dto.PortfolioRebalanceDetailResponse
	if err := json.Unmarshal(createRec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}

	startedAt := time.Now().UTC().Add(-5 * time.Minute)
	if err := db.Model(&models.PortfolioRebalanceRun{}).
		Where("id = ?", created.Run.ID).
		Updates(map[string]interface{}{
			"status":     models.PortfolioRebalanceRunStatusPlanning,
			"started_at": startedAt,
			"ended_at":   nil,
		}).Error; err != nil {
		t.Fatalf("update run status: %v", err)
	}

	endedAt := time.Now().UTC()
	starter.planningStatus = &workflows.RebalancePlanningStatus{
		RunID:     created.Run.ID,
		RunStatus: models.PortfolioRebalanceRunStatusPlanningFailed,
		Progress: workflows.RebalancePlanningProgress{
			CompletionPercent: 100,
			StageCode:         "planning_failed",
			StageMessage:      "Planning failed",
			StageIndex:        6,
			StageTotal:        6,
			IsTerminal:        true,
			LastEventAt:       &endedAt,
		},
	}

	executionRec := performJSONRequest(t, router, http.MethodGet,
		fmt.Sprintf("/me/portfolios/%d/rebalances/%d/status", profileID, created.Run.ID), nil)
	if executionRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", executionRec.Code, executionRec.Body.String())
	}

	var executionResp dto.PortfolioRebalanceStatusResponse
	if err := json.Unmarshal(executionRec.Body.Bytes(), &executionResp); err != nil {
		t.Fatalf("decode execution response: %v", err)
	}
	if executionResp.Run.Status != models.PortfolioRebalanceRunStatusPlanningFailed {
		t.Fatalf("expected run status %q, got %q", models.PortfolioRebalanceRunStatusPlanningFailed, executionResp.Run.Status)
	}

	var persisted models.PortfolioRebalanceRun
	if err := db.Where("id = ?", created.Run.ID).First(&persisted).Error; err != nil {
		t.Fatalf("load persisted run: %v", err)
	}
	if persisted.Status != models.PortfolioRebalanceRunStatusPlanningFailed {
		t.Fatalf("expected persisted status %q, got %q", models.PortfolioRebalanceRunStatusPlanningFailed, persisted.Status)
	}
	if persisted.EndedAt == nil {
		t.Fatalf("expected persisted ended_at to be set")
	}
}

func setupRebalanceTestRouter(t *testing.T, withReplication bool) (*gin.Engine, *gorm.DB, int) {
	return setupRebalanceTestRouterWithStarter(t, withReplication, nil)
}

func setupRebalanceTestRouterWithStarter(t *testing.T, withReplication bool, starter rebalance.ExecutionStarter) (*gin.Engine, *gorm.DB, int) {
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
		nil,
		mockProvider,
	)
	plannerService := rebalanceplanner.NewService(
		rebalanceplanner.NewRegistry(
			rebalanceplanner.NewFullAlgorithm(),
		),
	)
	if starter == nil {
		starter = &fakeRebalanceExecutionStarter{}
	}

	service := rebalance.NewService(
		profilesRepo,
		runsRepo,
		snapshotLoader,
		plannerService,
		services.NewAuditService(db),
		starter,
	)
	handler := NewPortfolioRebalanceHandler(service, nil, nil)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(utils.CustomContextKey, &utils.RequestContext{UserID: 500, RoleKey: "admin"})
		c.Next()
	})
	router.POST("/me/portfolios/:id/rebalances", handler.CreateRebalanceDraft)
	router.GET("/me/portfolios/:id/rebalances", handler.ListRebalances)
	router.GET("/me/portfolios/:id/rebalances/:rebalanceId", handler.GetRebalanceDetail)
	router.GET("/me/portfolios/:id/rebalances/:rebalanceId/status", handler.GetRebalanceStatus)
	router.DELETE("/me/portfolios/:id/rebalances/:rebalanceId", handler.DeleteRebalanceDraft)
	router.POST("/me/portfolios/:id/rebalances/:rebalanceId/execute", handler.ExecuteRebalance)

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

type fakeRebalanceExecutionStarter struct {
	planningCalls   int
	calls           int
	userID          int
	portfolioID     int
	runID           int
	planningStatus  *workflows.RebalancePlanningStatus
	planningErr     error
	executionStatus *workflows.RebalanceExecutionResult
	executionErr    error
}

func (s *fakeRebalanceExecutionStarter) StartRebalancePlanning(_ context.Context, _ int, _ int, _ int) error {
	s.planningCalls++
	return nil
}

func (s *fakeRebalanceExecutionStarter) StartRebalanceExecution(_ context.Context, userID int, portfolioID int, runID int) error {
	s.calls++
	s.userID = userID
	s.portfolioID = portfolioID
	s.runID = runID
	return nil
}

func (s *fakeRebalanceExecutionStarter) GetRebalancePlanningStatus(_ context.Context, runID int) (*workflows.RebalancePlanningStatus, error) {
	if s.planningErr != nil {
		return nil, s.planningErr
	}
	if s.planningStatus != nil {
		return s.planningStatus, nil
	}
	return nil, nil
}

func (s *fakeRebalanceExecutionStarter) GetRebalanceStatus(_ context.Context, runID int) (*workflows.RebalanceExecutionResult, error) {
	if s.executionErr != nil {
		return nil, s.executionErr
	}
	if s.executionStatus != nil {
		return s.executionStatus, nil
	}
	return &workflows.RebalanceExecutionResult{
		RunID:     runID,
		RunStatus: models.PortfolioRebalanceRunStatusExecuting,
		Progress: workflows.RebalanceExecutionProgress{
			TotalItems:      1,
			ActionableItems: 1,
			PendingItems:    1,
			StageCode:       "execution_preparing_items",
			StageMessage:    "Preparing execution items",
			StageIndex:      0,
			StageTotal:      1,
			IsTerminal:      false,
		},
		Items: []workflows.RebalanceExecutionItem{
			{
				ID:           1,
				Ticker:       "MOCKA",
				InstrumentID: "MOCKA",
				Side:         models.PortfolioRebalanceItemSideBuy,
				Status:       models.PortfolioRebalanceItemStatusPlanned,
			},
		},
		Links: []workflows.RebalanceExecutionLink{},
	}, nil
}
