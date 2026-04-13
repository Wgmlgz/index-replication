package telegram

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"time"

	"server/internal/api/dto"
	"server/internal/models"
)

func (s *VerificationService) GetTelegramStatus(userID int) (*dto.TelegramStatusResponse, error) {
	enabled, chatID, username, err := s.readTelegramStatus(userID)
	if err != nil {
		return nil, err
	}

	botUsername := ""
	if s.telegramService != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		name, _ := s.telegramService.GetBotUsername(ctx)
		botUsername = name
	}

	return &dto.TelegramStatusResponse{
		Connected:        chatID != 0,
		Login2FAEnabled:  enabled,
		BotUsername:      botUsername,
		TelegramUsername: username,
	}, nil
}

func (s *VerificationService) CreateTelegramConnectLink(userID int) (*dto.TelegramConnectResponse, error) {
	if s.telegramService == nil || !s.telegramService.Enabled() {
		return nil, fmt.Errorf("%w: TELEGRAM_BOT_TOKEN is empty", ErrTelegramUnavailable)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, err := s.telegramService.GetBotUsername(ctx); err != nil {
		log.Printf("verification: telegram bot username lookup failed user_id=%d err=%v", userID, err)
		return nil, err
	}

	token, err := randomToken(32)
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().UTC().Add(defaultConnectTokenTTL)
	if err := s.verificationRepo.CreateConnectToken(&models.TelegramConnectToken{
		Token:     token,
		UserID:    userID,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
	}); err != nil {
		return nil, err
	}

	connectURL := s.telegramService.StartLink(token)
	if connectURL == "" {
		return nil, fmt.Errorf("%w: bot username is empty; set TELEGRAM_BOT_USERNAME or allow getMe", ErrTelegramUnavailable)
	}
	return &dto.TelegramConnectResponse{
		ConnectURL: connectURL,
		ExpiresAt:  expiresAt,
	}, nil
}

func (s *VerificationService) UpdateTelegramLogin2FA(userID int, enabled bool) error {
	_, chatID, _, err := s.readTelegramStatus(userID)
	if err != nil {
		return err
	}
	if enabled && chatID == 0 {
		return ErrTelegramNotConnected
	}
	if err := s.userSettingsRepo.UpsertSettings(userID, map[string]string{
		settingTelegramLogin2FA: strconv.FormatBool(enabled),
	}); err != nil {
		return err
	}

	_ = s.auditLogger.LogUserAction(
		userID,
		models.ActionTelegram2FAUpdated,
		userID,
		map[string]interface{}{"login_2fa_enabled": enabled},
	)
	return nil
}

func (s *VerificationService) UnlinkTelegram(userID int) error {
	if err := s.userSettingsRepo.DeleteSettings(userID, []string{
		settingTelegramChatID,
		settingTelegramUsername,
		settingTelegramConnectedAt,
		settingTelegramLogin2FA,
	}); err != nil {
		return err
	}

	_ = s.auditLogger.LogUserAction(
		userID,
		models.ActionTelegramDisconnected,
		userID,
		nil,
	)
	return nil
}

func (s *VerificationService) linkTelegramWithToken(ctx context.Context, token string, chatID int64, telegramUsername string) error {
	now := time.Now().UTC()
	connectToken, err := s.verificationRepo.ConsumeConnectToken(token, now)
	if err != nil {
		_, _ = s.telegramService.SendMessage(
			ctx,
			chatID,
			"This connection link is invalid or expired. Generate a new one from Settings.",
			nil,
		)
		return errors.New("invalid or expired link")
	}

	current, err := s.userSettingsRepo.GetSettings(connectToken.UserID)
	if err != nil {
		_, _ = s.telegramService.SendMessage(
			ctx,
			chatID,
			"Failed to link account right now. Please try again.",
			nil,
		)
		return errors.New("failed to load account settings")
	}

	enabled := "false"
	if value, ok := current[settingTelegramLogin2FA]; ok {
		enabled = value
	}
	updateMap := map[string]string{
		settingTelegramChatID:      strconv.FormatInt(chatID, 10),
		settingTelegramUsername:    telegramUsername,
		settingTelegramConnectedAt: now.Format(time.RFC3339),
		settingTelegramLogin2FA:    enabled,
	}
	if err := s.userSettingsRepo.UpsertSettings(connectToken.UserID, updateMap); err != nil {
		_, _ = s.telegramService.SendMessage(
			ctx,
			chatID,
			"Failed to save connection. Please try again.",
			nil,
		)
		return errors.New("failed to save connection")
	}

	_ = s.auditLogger.LogUserAction(
		connectToken.UserID,
		models.ActionTelegramConnected,
		connectToken.UserID,
		map[string]interface{}{
			"telegram_username": telegramUsername,
		},
	)

	_, _ = s.telegramService.SendMessage(
		ctx,
		chatID,
		"Your account is linked. You can enable Telegram login verification in app settings.",
		nil,
	)
	return nil
}
