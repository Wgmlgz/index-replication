package handlers

import (
	"errors"
	"log"
	"net/http"

	"server/internal/api/dto"
	"server/internal/telegram"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

type VerificationHandler struct {
	verificationService telegramChannelService
}

type telegramChannelService interface {
	GetTelegramStatus(userID int) (*dto.TelegramStatusResponse, error)
	CreateTelegramConnectLink(userID int) (*dto.TelegramConnectResponse, error)
	UpdateTelegramLogin2FA(userID int, enabled bool) error
	UnlinkTelegram(userID int) error
}

func NewVerificationHandler(verificationService telegramChannelService) *VerificationHandler {
	return &VerificationHandler{verificationService: verificationService}
}

// GetTelegramStatus godoc
//
//	@Summary		Get Telegram channel status
//	@Description	Returns Telegram channel connection status and whether login approval is enabled
//	@Tags			channels
//	@Produce		json
//	@Success		200	{object}	dto.TelegramStatusResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/channels/telegram [get]
func (h *VerificationHandler) GetTelegramStatus(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	status, err := h.verificationService.GetTelegramStatus(userID)
	if err != nil {
		log.Printf("verification handler: failed to load telegram status user_id=%d err=%v", userID, err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to load Telegram verification status"})
		return
	}
	c.JSON(http.StatusOK, status)
}

// CreateTelegramConnectLink godoc
//
//	@Summary		Create Telegram channel connect link
//	@Description	Generates a one-time Telegram channel connect link for the current user
//	@Tags			channels
//	@Produce		json
//	@Success		200	{object}	dto.TelegramConnectResponse
//	@Failure		503	{object}	dto.ErrorResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/channels/telegram/connect [post]
func (h *VerificationHandler) CreateTelegramConnectLink(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	resp, err := h.verificationService.CreateTelegramConnectLink(userID)
	if err != nil {
		log.Printf("verification handler: failed to create telegram connect link user_id=%d err=%v", userID, err)
		if errors.Is(err, telegram.ErrTelegramUnavailable) {
			c.JSON(http.StatusServiceUnavailable, dto.ErrorResponse{Error: "Telegram bot is unavailable"})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to create Telegram connect link"})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// PatchTelegramSettings godoc
//
//	@Summary		Update Telegram channel settings
//	@Description	Updates Telegram login approval settings for the current user
//	@Tags			channels
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		dto.TelegramPatchRequest	true	"Telegram channel settings"
//	@Success		200		{object}	dto.TelegramStatusResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/channels/telegram [patch]
func (h *VerificationHandler) PatchTelegramSettings(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req dto.TelegramPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	if req.Login2FAEnabled != nil {
		if err := h.verificationService.UpdateTelegramLogin2FA(userID, *req.Login2FAEnabled); err != nil {
			log.Printf("verification handler: failed to patch telegram settings user_id=%d err=%v", userID, err)
			if errors.Is(err, telegram.ErrTelegramNotConnected) {
				c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Connect Telegram before enabling login verification"})
				return
			}
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to update Telegram verification settings"})
			return
		}
	}

	status, err := h.verificationService.GetTelegramStatus(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to load Telegram verification status"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// UnlinkTelegram godoc
//
//	@Summary		Unlink Telegram channel
//	@Description	Removes Telegram channel connection and disables Telegram login approval for the current user
//	@Tags			channels
//	@Produce		json
//	@Success		200	{object}	dto.TelegramStatusResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/channels/telegram [delete]
func (h *VerificationHandler) UnlinkTelegram(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	if err := h.verificationService.UnlinkTelegram(userID); err != nil {
		log.Printf("verification handler: failed to unlink telegram user_id=%d err=%v", userID, err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to unlink Telegram"})
		return
	}

	status, err := h.verificationService.GetTelegramStatus(userID)
	if err != nil {
		log.Printf("verification handler: failed to load telegram status after unlink user_id=%d err=%v", userID, err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Telegram unlinked, but status refresh failed"})
		return
	}

	c.JSON(http.StatusOK, status)
}
