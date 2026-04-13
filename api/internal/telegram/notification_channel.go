package telegram

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"server/internal/notifications"
	"server/internal/repository"
)

const channelKeyTelegram = "telegram"

type NotificationChannel struct {
	userSettingsRepo *repository.UserSettingsRepository
	telegramService  *TelegramService
}

func NewNotificationChannel(
	userSettingsRepo *repository.UserSettingsRepository,
	telegramService *TelegramService,
) *NotificationChannel {
	return &NotificationChannel{
		userSettingsRepo: userSettingsRepo,
		telegramService:  telegramService,
	}
}

func (c *NotificationChannel) Key() string {
	return channelKeyTelegram
}

func (c *NotificationChannel) Send(ctx context.Context, userID int, message notifications.Message) error {
	if c.telegramService == nil || !c.telegramService.Enabled() {
		return fmt.Errorf("%w: TELEGRAM_BOT_TOKEN is empty", ErrTelegramUnavailable)
	}
	if c.userSettingsRepo == nil {
		return errors.New("telegram user settings repository is not configured")
	}

	values, err := c.userSettingsRepo.GetSettings(userID)
	if err != nil {
		return err
	}
	rawChatID := strings.TrimSpace(values[settingTelegramChatID])
	if rawChatID == "" {
		return ErrTelegramNotConnected
	}
	chatID, err := strconv.ParseInt(rawChatID, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid telegram chat id in user settings: %w", err)
	}
	if chatID == 0 {
		return ErrTelegramNotConnected
	}

	text := strings.TrimSpace(message.Text())
	if text == "" {
		return notifications.ErrNoMessage
	}
	_, err = c.telegramService.SendMessage(ctx, chatID, text, nil)
	return err
}
