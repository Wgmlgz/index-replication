package telegram

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"server/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (s *VerificationService) CreateLoginChallengeIfEnabled(user *models.User, rememberMe bool) (*models.VerificationChallenge, error) {
	if user == nil {
		return nil, errors.New("user is required")
	}

	enabled, chatID, _, err := s.readTelegramStatus(user.ID)
	if err != nil {
		return nil, err
	}
	if !enabled {
		return nil, nil
	}
	if chatID == 0 {
		return nil, ErrTelegramNotConnected
	}
	if s.telegramService == nil || !s.telegramService.Enabled() {
		return nil, fmt.Errorf("%w: TELEGRAM_BOT_TOKEN is empty", ErrTelegramUnavailable)
	}

	now := time.Now().UTC()
	expiresAt := now.Add(s.loginChallengeTTL())
	detailsBytes, _ := json.Marshal(map[string]interface{}{
		"username": user.Username,
	})

	challenge := &models.VerificationChallenge{
		ID:         uuid.NewString(),
		UserID:     user.ID,
		Purpose:    models.VerificationPurposeLogin,
		Status:     models.VerificationStatusPending,
		RememberMe: rememberMe,
		Details:    string(detailsBytes),
		ExpiresAt:  expiresAt,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.verificationRepo.CreateChallenge(challenge); err != nil {
		return nil, err
	}

	keyboard := map[string]interface{}{
		"inline_keyboard": [][]map[string]string{
			{
				{
					"text":          "Approve login",
					"callback_data": callbackPrefixLoginApprove + challenge.ID,
				},
				{
					"text":          "Deny",
					"callback_data": callbackPrefixLoginDeny + challenge.ID,
				},
			},
		},
	}

	text := fmt.Sprintf(
		"Login attempt for %s.\nApprove this sign-in request?\nThis request expires at %s UTC.",
		user.Username,
		expiresAt.Format("2006-01-02 15:04:05"),
	)
	if _, err := s.telegramService.SendMessage(context.Background(), chatID, text, keyboard); err != nil {
		challenge.Status = models.VerificationStatusExpired
		challenge.UpdatedAt = time.Now().UTC()
		_ = s.verificationRepo.SaveChallenge(challenge)
		log.Printf("verification: failed to send login challenge to telegram user_id=%d chat_id=%d challenge_id=%s err=%v", user.ID, chatID, challenge.ID, err)
		return nil, fmt.Errorf("failed to deliver telegram verification message: %w", err)
	}

	_ = s.auditLogger.LogUserAction(
		user.ID,
		models.ActionLoginVerificationRequested,
		user.ID,
		map[string]interface{}{
			"challenge_id": challenge.ID,
			"expires_at":   challenge.ExpiresAt,
		},
	)

	return challenge, nil
}

func (s *VerificationService) ConsumeApprovedLoginChallenge(challengeID string) (*models.User, bool, error) {
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

func (s *VerificationService) loginChallengeTTL() time.Duration {
	seconds := s.cfg.LoginVerificationTTLSeconds
	if seconds <= 0 {
		seconds = defaultChallengeTTLSeconds
	}
	return time.Duration(seconds) * time.Second
}
