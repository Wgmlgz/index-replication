package telegram

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"server/internal/approvals"
	"server/internal/models"
)

func (s *VerificationService) CreateLoginChallengeIfEnabled(user *models.User, rememberMe bool) (*models.VerificationChallenge, error) {
	if user == nil {
		return nil, errors.New("user is required")
	}
	if s.approvalsService == nil {
		return nil, errors.New("approvals service is not configured")
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
	challenge, err := s.approvalsService.CreateChallenge(approvals.CreateChallengeInput{
		UserID:     user.ID,
		Purpose:    models.VerificationPurposeLogin,
		RememberMe: rememberMe,
		Details: map[string]interface{}{
			"username": user.Username,
		},
		ExpiresAt: expiresAt,
	})
	if err != nil {
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
		_ = s.approvalsService.MarkExpired(challenge, time.Now().UTC())
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
	if s.approvalsService == nil {
		return nil, false, errors.New("approvals service is not configured")
	}
	user, rememberMe, err := s.approvalsService.ConsumeApprovedLoginChallenge(challengeID)
	if errors.Is(err, approvals.ErrVerificationNotFound) {
		return nil, false, ErrVerificationNotFound
	}
	if errors.Is(err, approvals.ErrVerificationNotSupported) {
		return nil, false, ErrVerificationNotSupported
	}
	if errors.Is(err, approvals.ErrVerificationPending) {
		return nil, false, ErrVerificationPending
	}
	if errors.Is(err, approvals.ErrVerificationDenied) {
		return nil, false, ErrVerificationDenied
	}
	if errors.Is(err, approvals.ErrVerificationExpired) {
		return nil, false, ErrVerificationExpired
	}
	if errors.Is(err, approvals.ErrVerificationConsumed) {
		return nil, false, ErrVerificationConsumed
	}
	return user, rememberMe, err
}

func (s *VerificationService) loginChallengeTTL() time.Duration {
	seconds := s.cfg.LoginVerificationTTLSeconds
	if seconds <= 0 {
		seconds = defaultChallengeTTLSeconds
	}
	return time.Duration(seconds) * time.Second
}
