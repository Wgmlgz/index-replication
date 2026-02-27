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
	verificationService *telegram.VerificationService
}

func NewVerificationHandler(verificationService *telegram.VerificationService) *VerificationHandler {
	return &VerificationHandler{verificationService: verificationService}
}

// GetTelegramStatus godoc
//
//	@Summary		Get Telegram verification status
//	@Description	Returns Telegram connection status and whether login verification is enabled
//	@Tags			verification
//	@Produce		json
//	@Success		200	{object}	dto.TelegramStatusResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/verification/telegram [get]
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
//	@Summary		Create Telegram connect link
//	@Description	Generates a one-time Telegram connect link for the current user
//	@Tags			verification
//	@Produce		json
//	@Success		200	{object}	dto.TelegramConnectResponse
//	@Failure		503	{object}	dto.ErrorResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/verification/telegram/connect [post]
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
//	@Summary		Update Telegram verification settings
//	@Description	Updates Telegram login verification settings for the current user
//	@Tags			verification
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		dto.TelegramPatchRequest	true	"Telegram verification settings"
//	@Success		200		{object}	dto.TelegramStatusResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/verification/telegram [patch]
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
//	@Summary		Unlink Telegram verification
//	@Description	Removes Telegram connection and disables Telegram login verification for the current user
//	@Tags			verification
//	@Produce		json
//	@Success		200	{object}	dto.TelegramStatusResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/verification/telegram [delete]
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
