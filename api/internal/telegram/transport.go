package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"server/internal/config"

	"golang.org/x/net/proxy"
)

type TelegramUpdate struct {
	UpdateID      int64                  `json:"update_id"`
	Message       *TelegramMessage       `json:"message"`
	CallbackQuery *TelegramCallbackQuery `json:"callback_query"`
}

type TelegramMessage struct {
	MessageID int64        `json:"message_id"`
	Text      string       `json:"text"`
	Chat      TelegramChat `json:"chat"`
	From      TelegramFrom `json:"from"`
}

type TelegramCallbackQuery struct {
	ID      string          `json:"id"`
	Data    string          `json:"data"`
	From    TelegramFrom    `json:"from"`
	Message TelegramMessage `json:"message"`
}

type TelegramChat struct {
	ID int64 `json:"id"`
}

type TelegramFrom struct {
	Username string `json:"username"`
}

type TelegramService struct {
	cfg        *config.Config
	httpClient *http.Client

	mu          sync.RWMutex
	botUsername string
	startOnce   sync.Once
}

func NewTelegramService(cfg *config.Config) *TelegramService {
	httpTimeout := 20 * time.Second
	if cfg != nil && cfg.TelegramPollTimeoutSec > 0 {
		httpTimeout = time.Duration(cfg.TelegramPollTimeoutSec+15) * time.Second
	}

	httpClient := &http.Client{
		Timeout: httpTimeout,
	}
	if cfg != nil && strings.TrimSpace(cfg.TelegramSocks5Proxy) != "" {
		dialContext, err := buildSOCKS5DialContext(cfg.TelegramSocks5Proxy, httpTimeout)
		if err != nil {
			log.Printf("telegram: invalid TELEGRAM_SOCKS5_PROXY value: %v", err)
		} else {
			httpClient.Transport = &http.Transport{
				Proxy:             http.ProxyFromEnvironment,
				DialContext:       dialContext,
				ForceAttemptHTTP2: true,
			}
			log.Printf("telegram: using SOCKS5 proxy")
		}
	}

	return &TelegramService{
		cfg:        cfg,
		httpClient: httpClient,
	}
}

func (s *TelegramService) Enabled() bool {
	return strings.TrimSpace(s.cfg.TelegramBotToken) != ""
}

func (s *TelegramService) StartLink(token string) string {
	username := strings.TrimSpace(s.getCachedBotUsername())
	if username == "" {
		username = strings.TrimSpace(s.cfg.TelegramBotUsername)
	}
	if username == "" {
		return ""
	}
	return fmt.Sprintf("https://t.me/%s?start=%s", username, url.QueryEscape(token))
}

func (s *TelegramService) GetBotUsername(ctx context.Context) (string, error) {
	if value := s.getCachedBotUsername(); value != "" {
		return value, nil
	}

	if configured := strings.TrimSpace(s.cfg.TelegramBotUsername); configured != "" {
		s.setCachedBotUsername(configured)
		return configured, nil
	}

	if !s.Enabled() {
		return "", fmt.Errorf("telegram bot token is not configured")
	}

	var response struct {
		OK     bool `json:"ok"`
		Result struct {
			Username string `json:"username"`
		} `json:"result"`
	}
	if err := s.callTelegramJSON(ctx, "getMe", nil, &response); err != nil {
		return "", err
	}
	if !response.OK || strings.TrimSpace(response.Result.Username) == "" {
		return "", fmt.Errorf("telegram getMe failed")
	}
	s.setCachedBotUsername(response.Result.Username)
	return response.Result.Username, nil
}

func (s *TelegramService) StartPolling(ctx context.Context, handler func(TelegramUpdate)) {
	if !s.Enabled() || handler == nil {
		return
	}

	s.startOnce.Do(func() {
		go s.pollLoop(ctx, handler)
	})
}

func (s *TelegramService) SendMessage(ctx context.Context, chatID int64, text string, replyMarkup interface{}) (int64, error) {
	if !s.Enabled() {
		return 0, fmt.Errorf("telegram bot token is not configured")
	}

	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
	}
	if replyMarkup != nil {
		payload["reply_markup"] = replyMarkup
	}

	var response struct {
		OK     bool `json:"ok"`
		Result struct {
			MessageID int64 `json:"message_id"`
		} `json:"result"`
	}
	if err := s.callTelegramJSON(ctx, "sendMessage", payload, &response); err != nil {
		return 0, err
	}
	if !response.OK {
		return 0, fmt.Errorf("telegram sendMessage failed")
	}
	return response.Result.MessageID, nil
}

func (s *TelegramService) AnswerCallbackQuery(ctx context.Context, callbackID, text string, showAlert bool) error {
	if !s.Enabled() {
		return nil
	}
	payload := map[string]interface{}{
		"callback_query_id": callbackID,
		"text":              text,
		"show_alert":        showAlert,
	}
	var response struct {
		OK bool `json:"ok"`
	}
	if err := s.callTelegramJSON(ctx, "answerCallbackQuery", payload, &response); err != nil {
		return err
	}
	if !response.OK {
		return fmt.Errorf("telegram answerCallbackQuery failed")
	}
	return nil
}

func (s *TelegramService) pollLoop(ctx context.Context, handler func(TelegramUpdate)) {
	if _, err := s.GetBotUsername(ctx); err != nil {
		log.Printf("telegram: failed to resolve bot username: %v", err)
	}

	offset := int64(0)
	timeout := s.cfg.TelegramPollTimeoutSec
	if timeout <= 0 {
		timeout = 30
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		payload := map[string]interface{}{
			"offset":          offset,
			"timeout":         timeout,
			"allowed_updates": []string{"message", "callback_query"},
		}

		var response struct {
			OK     bool             `json:"ok"`
			Result []TelegramUpdate `json:"result"`
		}
		requestCtx, cancel := context.WithTimeout(ctx, time.Duration(timeout+15)*time.Second)
		err := s.callTelegramJSON(requestCtx, "getUpdates", payload, &response)
		cancel()
		if err != nil {
			log.Printf("telegram: getUpdates error: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}
		if !response.OK {
			log.Printf("telegram: getUpdates returned not ok")
			time.Sleep(2 * time.Second)
			continue
		}

		for _, update := range response.Result {
			handler(update)
			if update.UpdateID >= offset {
				offset = update.UpdateID + 1
			}
		}
	}
}

func (s *TelegramService) callTelegramJSON(ctx context.Context, method string, payload interface{}, out interface{}) error {
	if !s.Enabled() {
		return fmt.Errorf("telegram bot token is not configured")
	}

	endpoint := fmt.Sprintf("https://api.telegram.org/bot%s/%s", s.cfg.TelegramBotToken, method)

	var body io.Reader = http.NoBody
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	rawBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("telegram %s failed: status=%d body=%s", method, resp.StatusCode, string(rawBody))
	}

	if out == nil {
		return nil
	}
	if err := json.Unmarshal(rawBody, out); err != nil {
		return err
	}
	return nil
}

func (s *TelegramService) getCachedBotUsername() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.botUsername
}

func (s *TelegramService) setCachedBotUsername(username string) {
	trimmed := strings.TrimSpace(username)
	if trimmed == "" {
		return
	}
	s.mu.Lock()
	s.botUsername = trimmed
	s.mu.Unlock()
}

func buildSOCKS5DialContext(rawProxy string, timeout time.Duration) (func(context.Context, string, string) (net.Conn, error), error) {
	trimmed := strings.TrimSpace(rawProxy)
	if trimmed == "" {
		return nil, fmt.Errorf("proxy value is empty")
	}

	proxyURL, err := url.Parse(trimmed)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(proxyURL.Scheme, "socks5") {
		return nil, fmt.Errorf("unsupported proxy scheme %q (expected socks5)", proxyURL.Scheme)
	}
	host := strings.TrimSpace(proxyURL.Hostname())
	port := strings.TrimSpace(proxyURL.Port())
	if host == "" || port == "" {
		return nil, fmt.Errorf("proxy host must include hostname and port")
	}

	proxyAddr := net.JoinHostPort(host, port)
	var auth *proxy.Auth

	if proxyURL.User != nil {
		username := strings.TrimSpace(proxyURL.User.Username())
		if username == "" {
			return nil, fmt.Errorf("proxy username is empty")
		}
		password, _ := proxyURL.User.Password()
		auth = &proxy.Auth{User: username, Password: password}
	}

	baseDialer := &net.Dialer{
		Timeout:   timeout,
		KeepAlive: 30 * time.Second,
	}
	socksDialer, err := proxy.SOCKS5("tcp", proxyAddr, auth, baseDialer)
	if err != nil {
		return nil, err
	}
	if contextDialer, ok := socksDialer.(proxy.ContextDialer); ok {
		return contextDialer.DialContext, nil
	}
	return func(_ context.Context, network, address string) (net.Conn, error) {
		return socksDialer.Dial(network, address)
	}, nil
}
