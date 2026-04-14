package telegram

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"server/internal/approvals"
	"server/internal/models"
)

func (s *VerificationService) handleTelegramUpdate(update TelegramUpdate) {
	ctx := context.Background()
	if update.Message != nil {
		s.handleTelegramMessage(ctx, update.Message)
	}
	if update.CallbackQuery != nil {
		s.handleTelegramCallback(ctx, update.CallbackQuery)
	}
}

func (s *VerificationService) handleTelegramMessage(ctx context.Context, message *TelegramMessage) {
	if message == nil {
		return
	}
	token := extractStartToken(message.Text)
	if token == "" {
		return
	}

	keyboard := map[string]interface{}{
		"inline_keyboard": [][]map[string]string{
			{
				{
					"text":          "Connect account",
					"callback_data": callbackPrefixConnect + token,
				},
			},
		},
	}

	_, _ = s.telegramService.SendMessage(
		ctx,
		message.Chat.ID,
		"Tap the button below to confirm account linking.",
		keyboard,
	)
}

func (s *VerificationService) handleTelegramCallback(ctx context.Context, callback *TelegramCallbackQuery) {
	if callback == nil {
		return
	}

	var (
		challengeID     string
		approved        bool
		action          string
		callbackText    string
		expectedPurpose string
	)
	switch {
	case strings.HasPrefix(callback.Data, callbackPrefixLoginApprove):
		challengeID = strings.TrimPrefix(callback.Data, callbackPrefixLoginApprove)
		approved = true
		action = models.ActionLoginVerificationApproved
		callbackText = "Login approved."
		expectedPurpose = models.VerificationPurposeLogin
	case strings.HasPrefix(callback.Data, callbackPrefixLoginDeny):
		challengeID = strings.TrimPrefix(callback.Data, callbackPrefixLoginDeny)
		approved = false
		action = models.ActionLoginVerificationDenied
		callbackText = "Login denied."
		expectedPurpose = models.VerificationPurposeLogin
	case strings.HasPrefix(callback.Data, callbackPrefixRebalanceApprove):
		challengeID = strings.TrimPrefix(callback.Data, callbackPrefixRebalanceApprove)
		approved = true
		action = models.ActionRebalanceConfirmationYes
		callbackText = "Rebalance execution queued."
		expectedPurpose = models.VerificationPurposeRebalanceExecution
	case strings.HasPrefix(callback.Data, callbackPrefixRebalanceDeny):
		challengeID = strings.TrimPrefix(callback.Data, callbackPrefixRebalanceDeny)
		approved = false
		action = models.ActionRebalanceConfirmationNo
		callbackText = "Rebalance execution aborted."
		expectedPurpose = models.VerificationPurposeRebalanceExecution
	case strings.HasPrefix(callback.Data, callbackPrefixConnect):
		token := strings.TrimPrefix(callback.Data, callbackPrefixConnect)
		if token == "" {
			_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Invalid connection token.", true)
			return
		}
		if err := s.linkTelegramWithToken(ctx, token, callback.Message.Chat.ID, callback.From.Username); err != nil {
			_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, err.Error(), true)
			return
		}
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Account linked.", false)
		return
	default:
		return
	}

	if s.approvalsService == nil {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Approvals service is unavailable.", true)
		return
	}

	challenge, err := s.approvalsService.ApplyDecision(
		challengeID,
		expectedPurpose,
		approved,
		time.Now().UTC(),
	)
	if errors.Is(err, approvals.ErrVerificationNotFound) {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Request was not found.", true)
		return
	}
	if errors.Is(err, approvals.ErrVerificationNotSupported) {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Request type mismatch.", true)
		return
	}
	if errors.Is(err, approvals.ErrVerificationClosed) {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "This request is already closed.", false)
		return
	}
	if err != nil {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Failed to process response.", true)
		return
	}

	if approved &&
		challenge.Purpose == models.VerificationPurposeRebalanceExecution {
		if err := s.approvalsService.ExecuteApprovedRebalanceConfirmation(ctx, challenge); err != nil {
			log.Printf(
				"verification: failed to execute approved rebalance confirmation user_id=%d challenge_id=%s err=%v",
				challenge.UserID,
				challenge.ID,
				err,
			)
			_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Failed to queue execution.", true)
			return
		}
	}

	details := map[string]interface{}{"challenge_id": challenge.ID}
	if !approved {
		_ = s.auditLogger.LogUserErrorAction(
			challenge.UserID,
			action,
			challenge.UserID,
			details,
		)
	} else {
		_ = s.auditLogger.LogUserAction(
			challenge.UserID,
			action,
			challenge.UserID,
			details,
		)
	}
	_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, callbackText, false)
}
