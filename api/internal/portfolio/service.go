package portfolio

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/repository"

	"gorm.io/gorm"
)

type ProfilesRepository interface {
	ListByUser(userID int) ([]models.PortfolioProfile, error)
	GetByID(userID int, id int) (*models.PortfolioProfile, error)
	Create(profile *models.PortfolioProfile) error
	Update(profile *models.PortfolioProfile) error
	Delete(userID int, id int) (bool, error)
	SetDefault(userID int, id int) error
	CountByUser(userID int) (int64, error)
	EnsureSingleDefault(userID int) error
}

type AuditLogger interface {
	LogUserAction(performedBy int, action string, userID int, details interface{}) error
}

type Service struct {
	repo      ProfilesRepository
	audit     AuditLogger
	providers map[string]Provider
}

func NewService(repo ProfilesRepository, audit AuditLogger, providers ...Provider) *Service {
	registry := make(map[string]Provider, len(providers))
	for _, provider := range providers {
		registry[strings.ToLower(strings.TrimSpace(provider.Name()))] = provider
	}
	return &Service{
		repo:      repo,
		audit:     audit,
		providers: registry,
	}
}

func (s *Service) ListProfiles(ctx context.Context, userID int) ([]dto.PortfolioProfile, error) {
	rows, err := s.repo.ListByUser(userID)
	if err != nil {
		return nil, err
	}

	result := make([]dto.PortfolioProfile, 0, len(rows))
	for _, row := range rows {
		parsed, err := s.parseModel(&row)
		if err != nil {
			return nil, err
		}
		provider, ok := s.providerByName(parsed.Provider)
		if !ok {
			// Keep profile visible even if provider is no longer available.
			result = append(result, s.toProfileDTO(&row, parsed.Config, dto.PortfolioCapabilities{}))
			continue
		}
		result = append(result, s.toProfileDTO(&row, parsed.Config, provider.Capabilities(ctx, parsed)))
	}
	return result, nil
}

func (s *Service) CreateProfile(ctx context.Context, userID int, req *dto.PortfolioProfileCreateRequest) (*dto.PortfolioProfile, error) {
	if req == nil {
		return nil, ErrInvalidRequest
	}

	providerName := repository.NormalizeProvider(req.Provider)
	provider, ok := s.providerByName(providerName)
	if !ok {
		return nil, ErrInvalidProvider
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, ErrInvalidRequest
	}

	configJSON, err := encodeJSONMap(req.Config)
	if err != nil {
		return nil, ErrInvalidRequest
	}
	secretJSON, err := encodeJSONMap(req.Secret)
	if err != nil {
		return nil, ErrInvalidRequest
	}

	count, err := s.repo.CountByUser(userID)
	if err != nil {
		return nil, err
	}
	shouldBeDefault := req.IsDefault || count == 0

	model := &models.PortfolioProfile{
		UserID:     userID,
		Provider:   providerName,
		Name:       name,
		IsDefault:  shouldBeDefault,
		ConfigJSON: configJSON,
		SecretJSON: secretJSON,
	}
	if err := s.repo.Create(model); err != nil {
		return nil, err
	}
	if shouldBeDefault {
		if err := s.repo.SetDefault(userID, model.ID); err != nil {
			return nil, err
		}
		model.IsDefault = true
	}

	parsed, err := s.parseModel(model)
	if err != nil {
		return nil, err
	}

	_ = s.audit.LogUserAction(userID, models.ActionPortfolioProfileCreated, userID, map[string]interface{}{
		"profile_id":  model.ID,
		"provider":    model.Provider,
		"name":        model.Name,
		"is_default":  model.IsDefault,
		"has_secret":  len(parsed.Secret) > 0,
		"config_keys": sortedKeys(parsed.Config),
	})

	resp := s.toProfileDTO(model, parsed.Config, provider.Capabilities(ctx, parsed))
	return &resp, nil
}

func (s *Service) PatchProfile(ctx context.Context, userID int, id int, req *dto.PortfolioProfilePatchRequest) (*dto.PortfolioProfile, error) {
	if id <= 0 {
		return nil, ErrInvalidProfileID
	}
	if req == nil {
		return nil, ErrInvalidRequest
	}

	model, err := s.repo.GetByID(userID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProfileNotFound
		}
		return nil, err
	}

	wasDefault := model.IsDefault

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, ErrInvalidRequest
		}
		model.Name = name
	}

	if req.Config != nil {
		configJSON, encErr := encodeJSONMap(*req.Config)
		if encErr != nil {
			return nil, ErrInvalidRequest
		}
		model.ConfigJSON = configJSON
	}

	if req.Secret != nil {
		secretJSON, encErr := encodeJSONMap(*req.Secret)
		if encErr != nil {
			return nil, ErrInvalidRequest
		}
		model.SecretJSON = secretJSON
	}

	if req.IsDefault != nil {
		model.IsDefault = *req.IsDefault
	}

	if err := s.repo.Update(model); err != nil {
		return nil, err
	}
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.repo.SetDefault(userID, model.ID); err != nil {
			return nil, err
		}
		model.IsDefault = true
	}
	if req.IsDefault != nil && !*req.IsDefault && wasDefault {
		if err := s.repo.EnsureSingleDefault(userID); err != nil {
			return nil, err
		}
	}

	parsed, err := s.parseModel(model)
	if err != nil {
		return nil, err
	}
	provider, _ := s.providerByName(parsed.Provider)

	_ = s.audit.LogUserAction(userID, models.ActionPortfolioProfileUpdated, userID, map[string]interface{}{
		"profile_id": model.ID,
		"provider":   model.Provider,
		"name":       model.Name,
		"is_default": model.IsDefault,
	})

	capabilities := dto.PortfolioCapabilities{}
	if provider != nil {
		capabilities = provider.Capabilities(ctx, parsed)
	}
	resp := s.toProfileDTO(model, parsed.Config, capabilities)
	return &resp, nil
}

func (s *Service) DeleteProfile(userID int, id int) error {
	if id <= 0 {
		return ErrInvalidProfileID
	}

	model, err := s.repo.GetByID(userID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrProfileNotFound
		}
		return err
	}

	deleted, err := s.repo.Delete(userID, id)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrProfileNotFound
	}

	if model.IsDefault {
		if err := s.repo.EnsureSingleDefault(userID); err != nil {
			return err
		}
	}

	_ = s.audit.LogUserAction(userID, models.ActionPortfolioProfileDeleted, userID, map[string]interface{}{
		"profile_id": id,
		"provider":   model.Provider,
		"name":       model.Name,
	})
	return nil
}

func (s *Service) GetSummary(ctx context.Context, userID int, id int) (*dto.PortfolioSummaryResponse, error) {
	provider, profile, err := s.resolveProviderProfile(userID, id)
	if err != nil {
		return nil, err
	}
	resp, err := provider.GetSummary(ctx, profile)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderFailed, err)
	}
	resp.PortfolioID = profile.ID
	resp.Provider = profile.Provider
	resp.Name = profile.Name
	resp.Capabilities = provider.Capabilities(ctx, profile)
	return resp, nil
}

func (s *Service) GetHistory(ctx context.Context, userID int, id int, from, till string, intervalDays int) ([]dto.PortfolioHistoryPoint, error) {
	provider, profile, err := s.resolveProviderProfile(userID, id)
	if err != nil {
		return nil, err
	}
	points, err := provider.GetHistory(ctx, profile, from, till, intervalDays)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderFailed, err)
	}
	return points, nil
}

func (s *Service) GetComposition(ctx context.Context, userID int, id int, date string) ([]dto.PortfolioCompositionEntry, error) {
	provider, profile, err := s.resolveProviderProfile(userID, id)
	if err != nil {
		return nil, err
	}
	rows, err := provider.GetComposition(ctx, profile, date)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderFailed, err)
	}
	return rows, nil
}

func (s *Service) GetCompositionSeries(
	ctx context.Context,
	userID int,
	id int,
	tickers []string,
	topCount int,
	selectionMode string,
	selectionDate string,
	from string,
	till string,
	intervalDays int,
) (map[string][]dto.PortfolioCompositionSeriesPoint, error) {
	provider, profile, err := s.resolveProviderProfile(userID, id)
	if err != nil {
		return nil, err
	}
	rows, err := provider.GetCompositionSeries(ctx, profile, tickers, topCount, selectionMode, selectionDate, from, till, intervalDays)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderFailed, err)
	}
	return rows, nil
}

func (s *Service) GetOperations(ctx context.Context, userID int, id int, cursor string, limit int32) (*dto.PortfolioOperationsHistoryResponse, error) {
	provider, profile, err := s.resolveProviderProfile(userID, id)
	if err != nil {
		return nil, err
	}
	resp, err := provider.GetOperations(ctx, profile, cursor, limit)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderFailed, err)
	}
	resp.PortfolioID = profile.ID
	resp.Provider = profile.Provider
	return resp, nil
}

func (s *Service) RunAction(ctx context.Context, userID int, id int, action string, payload map[string]interface{}) (*dto.PortfolioActionResponse, error) {
	provider, profile, err := s.resolveProviderProfile(userID, id)
	if err != nil {
		return nil, err
	}
	action = strings.TrimSpace(strings.ToLower(action))
	if action == "" {
		return nil, ErrInvalidAction
	}

	result, err := provider.RunAction(ctx, profile, action, payload)
	if err != nil {
		if errors.Is(err, ErrInvalidAction) {
			return nil, err
		}
		return nil, fmt.Errorf("%w: %v", ErrProviderFailed, err)
	}

	_ = s.audit.LogUserAction(userID, models.ActionPortfolioActionExecuted, userID, map[string]interface{}{
		"profile_id": profile.ID,
		"provider":   profile.Provider,
		"action":     action,
	})

	return &dto.PortfolioActionResponse{
		Action: action,
		Result: result,
	}, nil
}

func (s *Service) resolveProviderProfile(userID int, id int) (Provider, *Profile, error) {
	if id <= 0 {
		return nil, nil, ErrInvalidProfileID
	}

	model, err := s.repo.GetByID(userID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, ErrProfileNotFound
		}
		return nil, nil, err
	}
	profile, err := s.parseModel(model)
	if err != nil {
		return nil, nil, err
	}
	provider, ok := s.providerByName(profile.Provider)
	if !ok {
		return nil, nil, ErrInvalidProvider
	}
	return provider, profile, nil
}

func (s *Service) providerByName(name string) (Provider, bool) {
	provider, ok := s.providers[strings.ToLower(strings.TrimSpace(name))]
	return provider, ok
}

func (s *Service) parseModel(model *models.PortfolioProfile) (*Profile, error) {
	config, err := decodeJSONMap(model.ConfigJSON)
	if err != nil {
		return nil, err
	}
	secret, err := decodeJSONMap(model.SecretJSON)
	if err != nil {
		return nil, err
	}
	return &Profile{
		ID:       model.ID,
		UserID:   model.UserID,
		Provider: repository.NormalizeProvider(model.Provider),
		Name:     model.Name,
		Config:   config,
		Secret:   secret,
	}, nil
}

func (s *Service) toProfileDTO(
	model *models.PortfolioProfile,
	config map[string]interface{},
	capabilities dto.PortfolioCapabilities,
) dto.PortfolioProfile {
	return dto.PortfolioProfile{
		ID:           model.ID,
		Provider:     model.Provider,
		Name:         model.Name,
		IsDefault:    model.IsDefault,
		Config:       config,
		CreatedAt:    model.CreatedAt,
		UpdatedAt:    model.UpdatedAt,
		Capabilities: capabilities,
	}
}

func encodeJSONMap(payload map[string]interface{}) (string, error) {
	if len(payload) == 0 {
		return "{}", nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func decodeJSONMap(value string) (map[string]interface{}, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return map[string]interface{}{}, nil
	}
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(trimmed), &result); err != nil {
		return nil, err
	}
	if result == nil {
		return map[string]interface{}{}, nil
	}
	return result, nil
}

func sortedKeys(payload map[string]interface{}) []string {
	if len(payload) == 0 {
		return []string{}
	}
	keys := make([]string, 0, len(payload))
	for key := range payload {
		keys = append(keys, key)
	}
	if len(keys) < 2 {
		return keys
	}
	for i := 0; i < len(keys)-1; i++ {
		for j := i + 1; j < len(keys); j++ {
			if keys[j] < keys[i] {
				keys[i], keys[j] = keys[j], keys[i]
			}
		}
	}
	return keys
}
