package telegram

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/config"
	"server/internal/repository"
)

const (
	settingTelegramChatID          = "security.telegram.chat_id"
	settingTelegramUsername        = "security.telegram.username"
	settingTelegramConnectedAt     = "security.telegram.connected_at"
	settingTelegramLogin2FA        = "security.telegram.login_2fa_enabled"
	defaultChallengeTTLSeconds     = 300
	defaultConnectTokenTTL         = 10 * time.Minute
	defaultRebalanceChallengeTTL   = 15 * time.Minute
	callbackPrefixLoginApprove     = "login:approve:"
	callbackPrefixLoginDeny        = "login:deny:"
	callbackPrefixConnect          = "connect:confirm:"
	callbackPrefixRebalanceApprove = "rebalance:approve:"
	callbackPrefixRebalanceDeny    = "rebalance:deny:"
	telegramMessageLimitChars      = 4096
)

var (
	ErrVerificationPending      = errors.New("verification pending")
	ErrVerificationDenied       = errors.New("verification denied")
	ErrVerificationExpired      = errors.New("verification expired")
	ErrVerificationConsumed     = errors.New("verification already consumed")
	ErrVerificationNotFound     = errors.New("verification challenge not found")
	ErrTelegramNotConnected     = errors.New("telegram account is not connected")
	ErrTelegramUnavailable      = errors.New("telegram bot is not available")
	ErrVerificationNotSupported = errors.New("verification challenge is not supported")
)

type VerificationService struct {
	cfg               *config.Config
	userRepo          *repository.UserRepository
	userSettingsRepo  *repository.UserSettingsRepository
	verificationRepo  *repository.VerificationRepository
	auditLogger       AuditLogger
	telegramService   *TelegramService
	rebalanceExecutor rebalanceExecutionService
}

type rebalanceExecutionService interface {
	ExecuteRun(
		ctx context.Context,
		userID int,
		portfolioID int,
		runID int,
	) (*dto.PortfolioRebalanceRun, error)
}

type AuditLogger interface {
	LogUserAction(performedBy int, action string, userID int, details interface{}) error
}

func NewVerificationService(
	cfg *config.Config,
	userRepo *repository.UserRepository,
	userSettingsRepo *repository.UserSettingsRepository,
	verificationRepo *repository.VerificationRepository,
	auditLogger AuditLogger,
	telegramService *TelegramService,
) *VerificationService {
	return &VerificationService{
		cfg:              cfg,
		userRepo:         userRepo,
		userSettingsRepo: userSettingsRepo,
		verificationRepo: verificationRepo,
		auditLogger:      auditLogger,
		telegramService:  telegramService,
	}
}

func (s *VerificationService) SetRebalanceExecutionExecutor(executor rebalanceExecutionService) {
	if s == nil {
		return
	}
	s.rebalanceExecutor = executor
}

func (s *VerificationService) StartTelegramPolling(ctx context.Context) {
	if s.telegramService == nil {
		log.Printf("verification: telegram polling not started (telegram service is nil)")
		return
	}
	if !s.telegramService.Enabled() {
		log.Printf("verification: telegram polling disabled (TELEGRAM_BOT_TOKEN is empty)")
		return
	}
	log.Printf("verification: starting telegram polling loop")
	s.telegramService.StartPolling(ctx, s.handleTelegramUpdate)
}

func (s *VerificationService) readTelegramStatus(userID int) (enabled bool, chatID int64, username string, err error) {
	values, err := s.userSettingsRepo.GetSettings(userID)
	if err != nil {
		return false, 0, "", err
	}

	enabled = parseBool(values[settingTelegramLogin2FA])
	if rawChatID := strings.TrimSpace(values[settingTelegramChatID]); rawChatID != "" {
		chatID, err = strconv.ParseInt(rawChatID, 10, 64)
		if err != nil {
			return false, 0, "", fmt.Errorf("invalid telegram chat id in user settings: %w", err)
		}
	}
	username = strings.TrimSpace(values[settingTelegramUsername])
	return enabled, chatID, username, nil
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func extractStartToken(text string) string {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" || !strings.HasPrefix(trimmed, "/start") {
		return ""
	}
	parts := strings.Fields(trimmed)
	if len(parts) < 2 {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
