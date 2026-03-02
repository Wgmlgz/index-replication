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

func TestService_RoutesToProvider(t *testing.T) {
	repo := newFakeRepo()
	provider := &fakeProvider{}
	service := NewService(repo, &fakeAudit{}, provider)

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
	service := NewService(repo, &fakeAudit{}, &fakeProvider{})

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
