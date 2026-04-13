package approvals

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"server/internal/api/dto"
	"server/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrVerificationPending      = errors.New("verification pending")
	ErrVerificationDenied       = errors.New("verification denied")
	ErrVerificationExpired      = errors.New("verification expired")
	ErrVerificationConsumed     = errors.New("verification already consumed")
	ErrVerificationNotFound     = errors.New("verification challenge not found")
	ErrVerificationNotSupported = errors.New("verification challenge is not supported")
	ErrVerificationClosed       = errors.New("verification challenge is already closed")
)

type verificationRepository interface {
	CreateChallenge(challenge *models.VerificationChallenge) error
	GetChallengeByID(id string) (*models.VerificationChallenge, error)
	SaveChallenge(challenge *models.VerificationChallenge) error
	ExpirePendingChallenges(now time.Time, purpose string) error
}

type userRepository interface {
	GetCurrentUser(userID interface{}) (*models.User, error)
}

type RebalanceExecutionExecutor interface {
	ExecuteRun(
		ctx context.Context,
		userID int,
		portfolioID int,
		runID int,
	) (*dto.PortfolioRebalanceRun, error)
}

type Service struct {
	verificationRepo  verificationRepository
	userRepo          userRepository
	rebalanceExecutor RebalanceExecutionExecutor
}

type CreateChallengeInput struct {
	UserID     int
	Purpose    string
	RememberMe bool
	Details    map[string]interface{}
	ExpiresAt  time.Time
}

func NewService(
	verificationRepo verificationRepository,
	userRepo userRepository,
) *Service {
	return &Service{
		verificationRepo: verificationRepo,
		userRepo:         userRepo,
	}
}

func (s *Service) SetRebalanceExecutionExecutor(executor RebalanceExecutionExecutor) {
	if s == nil {
		return
	}
	s.rebalanceExecutor = executor
}

func (s *Service) CreateChallenge(input CreateChallengeInput) (*models.VerificationChallenge, error) {
	if input.UserID <= 0 {
		return nil, errors.New("invalid user id")
	}
	if input.Purpose == "" {
		return nil, errors.New("purpose is required")
	}
	if input.ExpiresAt.IsZero() {
		return nil, errors.New("expires_at is required")
	}

	now := time.Now().UTC()
	detailsRaw := ""
	if len(input.Details) > 0 {
		detailsJSON, err := json.Marshal(input.Details)
		if err != nil {
			return nil, fmt.Errorf("encode challenge details: %w", err)
		}
		detailsRaw = string(detailsJSON)
	}

	challenge := &models.VerificationChallenge{
		ID:         uuid.NewString(),
		UserID:     input.UserID,
		Purpose:    input.Purpose,
		Status:     models.VerificationStatusPending,
		RememberMe: input.RememberMe,
		Details:    detailsRaw,
		ExpiresAt:  input.ExpiresAt.UTC(),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.verificationRepo.CreateChallenge(challenge); err != nil {
		return nil, err
	}
	return challenge, nil
}

func (s *Service) MarkExpired(challenge *models.VerificationChallenge, now time.Time) error {
	if challenge == nil {
		return errors.New("challenge is required")
	}
	challenge.Status = models.VerificationStatusExpired
	challenge.UpdatedAt = now.UTC()
	return s.verificationRepo.SaveChallenge(challenge)
}

func (s *Service) ApplyDecision(
	challengeID string,
	expectedPurpose string,
	approved bool,
	now time.Time,
) (*models.VerificationChallenge, error) {
	challenge, err := s.verificationRepo.GetChallengeByID(challengeID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrVerificationNotFound
		}
		return nil, err
	}

	if expectedPurpose != "" && challenge.Purpose != expectedPurpose {
		return nil, ErrVerificationNotSupported
	}

	currentTime := now.UTC()
	if currentTime.After(challenge.ExpiresAt) && challenge.Status == models.VerificationStatusPending {
		challenge.Status = models.VerificationStatusExpired
		challenge.UpdatedAt = currentTime
		_ = s.verificationRepo.SaveChallenge(challenge)
	}

	if challenge.Status != models.VerificationStatusPending {
		return nil, ErrVerificationClosed
	}

	if approved {
		challenge.Status = models.VerificationStatusApproved
		challenge.ApprovedAt = &currentTime
	} else {
		challenge.Status = models.VerificationStatusDenied
		challenge.DeniedAt = &currentTime
	}
	challenge.UpdatedAt = currentTime

	if err := s.verificationRepo.SaveChallenge(challenge); err != nil {
		return nil, err
	}
	return challenge, nil
}

func (s *Service) ConsumeApprovedLoginChallenge(challengeID string) (*models.User, bool, error) {
	now := time.Now().UTC()
	_ = s.verificationRepo.ExpirePendingChallenges(now, models.VerificationPurposeLogin)

	challenge, err := s.verificationRepo.GetChallengeByID(challengeID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, ErrVerificationNotFound
		}
		return nil, false, err
	}
	if challenge.Purpose != models.VerificationPurposeLogin {
		return nil, false, ErrVerificationNotSupported
	}

	if now.After(challenge.ExpiresAt) && challenge.Status == models.VerificationStatusPending {
		challenge.Status = models.VerificationStatusExpired
		challenge.UpdatedAt = now
		_ = s.verificationRepo.SaveChallenge(challenge)
	}

	switch challenge.Status {
	case models.VerificationStatusPending:
		return nil, false, ErrVerificationPending
	case models.VerificationStatusDenied:
		return nil, false, ErrVerificationDenied
	case models.VerificationStatusExpired:
		return nil, false, ErrVerificationExpired
	case models.VerificationStatusConsumed:
		return nil, false, ErrVerificationConsumed
	case models.VerificationStatusApproved:
	default:
		return nil, false, ErrVerificationNotSupported
	}

	challenge.Status = models.VerificationStatusConsumed
	challenge.ConsumedAt = &now
	challenge.UpdatedAt = now
	if err := s.verificationRepo.SaveChallenge(challenge); err != nil {
		return nil, false, err
	}

	user, err := s.userRepo.GetCurrentUser(challenge.UserID)
	if err != nil {
		return nil, false, err
	}
	return user, challenge.RememberMe, nil
}

func (s *Service) ExecuteApprovedRebalanceConfirmation(
	ctx context.Context,
	challenge *models.VerificationChallenge,
) error {
	if challenge == nil {
		return errors.New("rebalance challenge is nil")
	}
	if challenge.Purpose != models.VerificationPurposeRebalanceExecution {
		return ErrVerificationNotSupported
	}
	if s.rebalanceExecutor == nil {
		return errors.New("rebalance executor is not configured")
	}

	var details struct {
		PortfolioID int `json:"portfolio_id"`
		RunID       int `json:"run_id"`
	}
	if err := json.Unmarshal([]byte(challenge.Details), &details); err != nil {
		return fmt.Errorf("decode rebalance challenge details: %w", err)
	}
	if details.PortfolioID <= 0 || details.RunID <= 0 {
		return errors.New("invalid rebalance challenge details")
	}

	_, err := s.rebalanceExecutor.ExecuteRun(
		ctx,
		challenge.UserID,
		details.PortfolioID,
		details.RunID,
	)
	return err
}
