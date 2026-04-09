package portfolio

import (
	"context"
	"errors"
	"testing"
	"time"

	"server/internal/api/dto"
	"server/internal/models"

	"gorm.io/gorm"
)

type fakeRepo struct {
	nextID   int
	profiles map[int]*models.PortfolioProfile
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		nextID:   1,
		profiles: make(map[int]*models.PortfolioProfile),
	}
}

func (r *fakeRepo) ListByUser(userID int) ([]models.PortfolioProfile, error) {
	rows := make([]models.PortfolioProfile, 0)
	for _, row := range r.profiles {
		if row.UserID == userID {
			rows = append(rows, *row)
		}
	}
	return rows, nil
}

func (r *fakeRepo) GetByID(userID int, id int) (*models.PortfolioProfile, error) {
	row, ok := r.profiles[id]
	if !ok || row.UserID != userID {
		return nil, gorm.ErrRecordNotFound
	}
	copy := *row
	return &copy, nil
}

func (r *fakeRepo) Create(profile *models.PortfolioProfile) error {
	profile.ID = r.nextID
	profile.CreatedAt = time.Now().UTC()
	profile.UpdatedAt = profile.CreatedAt
	copy := *profile
	r.profiles[profile.ID] = &copy
	r.nextID++
	return nil
}

func (r *fakeRepo) Update(profile *models.PortfolioProfile) error {
	if _, ok := r.profiles[profile.ID]; !ok {
		return gorm.ErrRecordNotFound
	}
	copy := *profile
	copy.UpdatedAt = time.Now().UTC()
	r.profiles[profile.ID] = &copy
	return nil
}

func (r *fakeRepo) Delete(userID int, id int) (bool, error) {
	row, ok := r.profiles[id]
	if !ok || row.UserID != userID {
		return false, nil
	}
	delete(r.profiles, id)
	return true, nil
}

func (r *fakeRepo) SetDefault(userID int, id int) error {
	target, ok := r.profiles[id]
	if !ok || target.UserID != userID {
		return gorm.ErrRecordNotFound
	}
	for _, row := range r.profiles {
		if row.UserID == userID {
			row.IsDefault = false
		}
	}
	target.IsDefault = true
	return nil
}

func (r *fakeRepo) CountByUser(userID int) (int64, error) {
	count := int64(0)
	for _, row := range r.profiles {
		if row.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (r *fakeRepo) EnsureSingleDefault(userID int) error {
	hasDefault := false
	firstID := 0
	for id, row := range r.profiles {
		if row.UserID != userID {
			continue
		}
		if firstID == 0 {
			firstID = id
		}
		if row.IsDefault {
			hasDefault = true
		}
	}
	if hasDefault || firstID == 0 {
		return nil
	}
	return r.SetDefault(userID, firstID)
}

type fakeAudit struct{}

func (f *fakeAudit) LogUserAction(_ int, _ string, _ int, _ interface{}) error {
	return nil
}

type fakeReplicationRepo struct {
	configs    map[int]models.PortfolioReplicationConfig
	benchmarks map[string]bool
}

func newFakeReplicationRepo() *fakeReplicationRepo {
	return &fakeReplicationRepo{
		configs:    make(map[int]models.PortfolioReplicationConfig),
		benchmarks: map[string]bool{"IMOEX": true},
	}
}

func (r *fakeReplicationRepo) ListByPortfolioProfileIDs(profileIDs []int) (map[int]models.PortfolioReplicationConfig, error) {
	result := make(map[int]models.PortfolioReplicationConfig)
	for _, profileID := range profileIDs {
		if row, ok := r.configs[profileID]; ok {
			result[profileID] = row
		}
	}
	return result, nil
}

func (r *fakeReplicationRepo) GetByPortfolioProfileID(profileID int) (*models.PortfolioReplicationConfig, error) {
	row, ok := r.configs[profileID]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	copy := row
	return &copy, nil
}

func (r *fakeReplicationRepo) Upsert(config *models.PortfolioReplicationConfig) (*models.PortfolioReplicationConfig, error) {
	if config == nil {
		return nil, gorm.ErrInvalidData
	}
	next := *config
	next.ID = config.PortfolioProfileID
	next.UpdatedAt = time.Now().UTC()
	r.configs[config.PortfolioProfileID] = next
	copy := next
	return &copy, nil
}

func (r *fakeReplicationRepo) DeleteByPortfolioProfileID(profileID int) (bool, error) {
	if _, ok := r.configs[profileID]; !ok {
		return false, nil
	}
	delete(r.configs, profileID)
	return true, nil
}

func (r *fakeReplicationRepo) BenchmarkExists(secid string) (bool, error) {
	return r.benchmarks[secid], nil
}

type fakeProvider struct {
	calledSummary bool
}

func (p *fakeProvider) Name() string {
	return "mock"
}

func (p *fakeProvider) Capabilities(_ context.Context, _ *Profile) dto.PortfolioCapabilities {
	return dto.PortfolioCapabilities{
		Actions: []dto.PortfolioProviderAction{{ID: "noop", Label: "Noop"}},
	}
}

func (p *fakeProvider) GetSummary(_ context.Context, _ *Profile) (*dto.PortfolioSummaryResponse, error) {
	p.calledSummary = true
	return &dto.PortfolioSummaryResponse{
		TotalAmountPortfolio: 123,
	}, nil
}

func (p *fakeProvider) GetHistory(_ context.Context, _ *Profile, _ string, _ string, _ int) ([]dto.PortfolioHistoryPoint, error) {
	return []dto.PortfolioHistoryPoint{}, nil
}

func (p *fakeProvider) GetComposition(_ context.Context, _ *Profile, _ string) ([]dto.PortfolioCompositionEntry, error) {
	return []dto.PortfolioCompositionEntry{}, nil
}

func (p *fakeProvider) GetCompositionSeries(_ context.Context, _ *Profile, _ []string, _ int, _ string, _ string, _ string, _ string, _ int) (map[string][]dto.PortfolioCompositionSeriesPoint, error) {
	return map[string][]dto.PortfolioCompositionSeriesPoint{}, nil
}

func (p *fakeProvider) GetOperations(_ context.Context, _ *Profile, _ string, _ int32) (*dto.PortfolioOperationsHistoryResponse, error) {
	return &dto.PortfolioOperationsHistoryResponse{}, nil
}

func (p *fakeProvider) RunAction(_ context.Context, _ *Profile, _ string, _ map[string]interface{}) (map[string]interface{}, error) {
	return nil, ErrInvalidAction
}

type fakeCreatePreparerProvider struct {
	*fakeProvider
	called      bool
	returnedErr error
}

func (p *fakeCreatePreparerProvider) PrepareCreateProfile(
	_ context.Context,
	_ int,
	req *dto.PortfolioProfileCreateRequest,
) error {
	p.called = true
	if p.returnedErr != nil {
		return p.returnedErr
	}
	if req.Config == nil {
		req.Config = map[string]interface{}{}
	}
	req.Config["prepared"] = "yes"
	return nil
}

type fakeActionProvider struct {
	receivedPayload map[string]interface{}
}

func (p *fakeActionProvider) Name() string {
	return "mock"
}

func (p *fakeActionProvider) Capabilities(_ context.Context, _ *Profile) dto.PortfolioCapabilities {
	return dto.PortfolioCapabilities{}
}

func (p *fakeActionProvider) GetSummary(_ context.Context, _ *Profile) (*dto.PortfolioSummaryResponse, error) {
	return &dto.PortfolioSummaryResponse{}, nil
}

func (p *fakeActionProvider) GetHistory(_ context.Context, _ *Profile, _ string, _ string, _ int) ([]dto.PortfolioHistoryPoint, error) {
	return []dto.PortfolioHistoryPoint{}, nil
}

func (p *fakeActionProvider) GetComposition(_ context.Context, _ *Profile, _ string) ([]dto.PortfolioCompositionEntry, error) {
	return []dto.PortfolioCompositionEntry{}, nil
}

func (p *fakeActionProvider) GetCompositionSeries(_ context.Context, _ *Profile, _ []string, _ int, _ string, _ string, _ string, _ string, _ int) (map[string][]dto.PortfolioCompositionSeriesPoint, error) {
	return map[string][]dto.PortfolioCompositionSeriesPoint{}, nil
}

func (p *fakeActionProvider) GetOperations(_ context.Context, _ *Profile, _ string, _ int32) (*dto.PortfolioOperationsHistoryResponse, error) {
	return &dto.PortfolioOperationsHistoryResponse{}, nil
}

func (p *fakeActionProvider) RunAction(_ context.Context, _ *Profile, _ string, payload map[string]interface{}) (map[string]interface{}, error) {
	p.receivedPayload = payload
	return map[string]interface{}{
		"status": "ok",
	}, nil
}

func TestService_RoutesToProvider(t *testing.T) {
	repo := newFakeRepo()
	replicationRepo := newFakeReplicationRepo()
	provider := &fakeProvider{}
	service := NewService(repo, replicationRepo, &fakeAudit{}, provider)

	created, err := service.CreateProfile(context.Background(), 9, &dto.PortfolioProfileCreateRequest{
		Provider: "mock",
		Name:     "My Mock",
	})
	if err != nil {
		t.Fatalf("create profile: %v", err)
	}

	summary, err := service.GetSummary(context.Background(), 9, created.ID)
	if err != nil {
		t.Fatalf("get summary: %v", err)
	}
	if summary.TotalAmountPortfolio != 123 {
		t.Fatalf("expected summary amount 123, got %v", summary.TotalAmountPortfolio)
	}
	if !provider.calledSummary {
		t.Fatalf("expected provider summary to be called")
	}
}

func TestService_ProviderSelectionErrors(t *testing.T) {
	repo := newFakeRepo()
	replicationRepo := newFakeReplicationRepo()
	service := NewService(repo, replicationRepo, &fakeAudit{}, &fakeProvider{})

	_, err := service.CreateProfile(context.Background(), 9, &dto.PortfolioProfileCreateRequest{
		Provider: "unknown",
		Name:     "Bad",
	})
	if !errors.Is(err, ErrInvalidProvider) {
		t.Fatalf("expected ErrInvalidProvider, got %v", err)
	}

	_, err = service.GetSummary(context.Background(), 9, 99)
	if !errors.Is(err, ErrProfileNotFound) {
		t.Fatalf("expected ErrProfileNotFound, got %v", err)
	}
}

func TestService_PatchProfileCanUnsetDefault(t *testing.T) {
	repo := newFakeRepo()
	replicationRepo := newFakeReplicationRepo()
	service := NewService(repo, replicationRepo, &fakeAudit{}, &fakeProvider{})

	first, err := service.CreateProfile(context.Background(), 9, &dto.PortfolioProfileCreateRequest{
		Provider: "mock",
		Name:     "First",
	})
	if err != nil {
		t.Fatalf("create first profile: %v", err)
	}
	if !first.IsDefault {
		t.Fatalf("expected first profile to be default")
	}

	_, err = service.CreateProfile(context.Background(), 9, &dto.PortfolioProfileCreateRequest{
		Provider: "mock",
		Name:     "Second",
	})
	if err != nil {
		t.Fatalf("create second profile: %v", err)
	}

	isDefault := false
	updated, err := service.PatchProfile(context.Background(), 9, first.ID, &dto.PortfolioProfilePatchRequest{
		IsDefault: &isDefault,
	})
	if err != nil {
		t.Fatalf("patch profile: %v", err)
	}
	if updated.IsDefault {
		t.Fatalf("expected patched profile to be non-default")
	}

	rows, err := repo.ListByUser(9)
	if err != nil {
		t.Fatalf("list profiles: %v", err)
	}
	defaultCount := 0
	for _, row := range rows {
		if row.IsDefault {
			defaultCount++
		}
	}
	if defaultCount != 0 {
		t.Fatalf("expected zero default profiles, got %d", defaultCount)
	}
}

func TestService_CreateProfileCallsProviderPreparer(t *testing.T) {
	repo := newFakeRepo()
	replicationRepo := newFakeReplicationRepo()
	provider := &fakeCreatePreparerProvider{
		fakeProvider: &fakeProvider{},
	}
	service := NewService(repo, replicationRepo, &fakeAudit{}, provider)

	created, err := service.CreateProfile(context.Background(), 9, &dto.PortfolioProfileCreateRequest{
		Provider: "mock",
		Name:     "My Mock",
	})
	if err != nil {
		t.Fatalf("create profile: %v", err)
	}
	if !provider.called {
		t.Fatalf("expected provider preparer to be called")
	}
	if created.Config["prepared"] != "yes" {
		t.Fatalf("expected prepared config flag, got %+v", created.Config)
	}
}

func TestService_RunActionRequiresActionID(t *testing.T) {
	repo := newFakeRepo()
	replicationRepo := newFakeReplicationRepo()
	provider := &fakeActionProvider{}
	service := NewService(repo, replicationRepo, &fakeAudit{}, provider)

	created, err := service.CreateProfile(context.Background(), 9, &dto.PortfolioProfileCreateRequest{
		Provider: "mock",
		Name:     "My Mock",
	})
	if err != nil {
		t.Fatalf("create profile: %v", err)
	}

	_, err = service.RunAction(context.Background(), 9, created.ID, "refresh", map[string]interface{}{})
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected ErrInvalidRequest for missing action_id, got %v", err)
	}

	_, err = service.RunAction(context.Background(), 9, created.ID, "refresh", map[string]interface{}{
		"action_id": "not-a-uuid",
	})
	if !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected ErrInvalidRequest for invalid action_id, got %v", err)
	}
}

func TestService_RunActionPassesActionIDToProvider(t *testing.T) {
	repo := newFakeRepo()
	replicationRepo := newFakeReplicationRepo()
	provider := &fakeActionProvider{}
	service := NewService(repo, replicationRepo, &fakeAudit{}, provider)

	created, err := service.CreateProfile(context.Background(), 9, &dto.PortfolioProfileCreateRequest{
		Provider: "mock",
		Name:     "My Mock",
	})
	if err != nil {
		t.Fatalf("create profile: %v", err)
	}

	actionID := "55555555-5555-5555-5555-555555555555"
	resp, err := service.RunAction(context.Background(), 9, created.ID, "refresh", map[string]interface{}{
		"action_id": actionID,
	})
	if err != nil {
		t.Fatalf("run action: %v", err)
	}

	if provider.receivedPayload == nil {
		t.Fatalf("expected provider payload")
	}
	if provider.receivedPayload["action_id"] != actionID {
		t.Fatalf("expected provider action_id=%s, got %v", actionID, provider.receivedPayload["action_id"])
	}
	if resp.Result == nil || resp.Result["action_id"] != actionID {
		t.Fatalf("expected response action_id=%s, got %+v", actionID, resp.Result)
	}
}
