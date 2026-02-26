package dto

import "time"

type TelegramStatusResponse struct {
	Connected        bool   `json:"connected"`
	Login2FAEnabled  bool   `json:"login_2fa_enabled"`
	BotUsername      string `json:"bot_username,omitempty"`
	TelegramUsername string `json:"telegram_username,omitempty"`
} //@name TelegramStatusResponse

type TelegramConnectResponse struct {
	ConnectURL string    `json:"connect_url"`
	ExpiresAt  time.Time `json:"expires_at"`
} //@name TelegramConnectResponse

type TelegramPatchRequest struct {
	Login2FAEnabled *bool `json:"login_2fa_enabled"`
} //@name TelegramPatchRequest
