package telegram

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/config"
	"server/internal/models"
	"server/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	settingTelegramChatID      = "security.telegram.chat_id"
	settingTelegramUsername    = "security.telegram.username"
	settingTelegramConnectedAt = "security.telegram.connected_at"
	settingTelegramLogin2FA    = "security.telegram.login_2fa_enabled"
	defaultChallengeTTLSeconds = 300
	defaultConnectTokenTTL     = 10 * time.Minute
	callbackPrefixLoginApprove = "login:approve:"
	callbackPrefixLoginDeny    = "login:deny:"
	callbackPrefixConnect      = "connect:confirm:"
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
	cfg              *config.Config
	userRepo         *repository.UserRepository
	userSettingsRepo *repository.UserSettingsRepository
	verificationRepo *repository.VerificationRepository
	auditLogger      AuditLogger
	telegramService  *TelegramService
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
	_ = s.verificationRepo.ExpirePendingChallenges(now)

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
		challengeID string
		newStatus   string
		action      string
	)
	switch {
	case strings.HasPrefix(callback.Data, callbackPrefixLoginApprove):
		challengeID = strings.TrimPrefix(callback.Data, callbackPrefixLoginApprove)
		newStatus = models.VerificationStatusApproved
		action = models.ActionLoginVerificationApproved
	case strings.HasPrefix(callback.Data, callbackPrefixLoginDeny):
		challengeID = strings.TrimPrefix(callback.Data, callbackPrefixLoginDeny)
		newStatus = models.VerificationStatusDenied
		action = models.ActionLoginVerificationDenied
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

	challenge, err := s.verificationRepo.GetChallengeByID(challengeID)
	if err != nil {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Request was not found.", true)
		return
	}
	if challenge.Purpose != models.VerificationPurposeLogin {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Unsupported verification request.", true)
		return
	}

	now := time.Now().UTC()
	if now.After(challenge.ExpiresAt) && challenge.Status == models.VerificationStatusPending {
		challenge.Status = models.VerificationStatusExpired
		challenge.UpdatedAt = now
		_ = s.verificationRepo.SaveChallenge(challenge)
	}

	if challenge.Status != models.VerificationStatusPending {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "This request is already closed.", false)
		return
	}

	challenge.Status = newStatus
	challenge.UpdatedAt = now
	if newStatus == models.VerificationStatusApproved {
		challenge.ApprovedAt = &now
	} else {
		challenge.DeniedAt = &now
	}
	if err := s.verificationRepo.SaveChallenge(challenge); err != nil {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Failed to process response.", true)
		return
	}

	_ = s.auditLogger.LogUserAction(
		challenge.UserID,
		action,
		challenge.UserID,
		map[string]interface{}{"challenge_id": challenge.ID},
	)

	if newStatus == models.VerificationStatusApproved {
		_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Login approved.", false)
		return
	}
	_ = s.telegramService.AnswerCallbackQuery(ctx, callback.ID, "Login denied.", false)
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

func (s *VerificationService) loginChallengeTTL() time.Duration {
	seconds := s.cfg.LoginVerificationTTLSeconds
	if seconds <= 0 {
		seconds = defaultChallengeTTLSeconds
	}
	return time.Duration(seconds) * time.Second
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
