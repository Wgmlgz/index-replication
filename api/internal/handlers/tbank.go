package handlers

import (
	"errors"
	"net/http"
	"strings"

	"server/internal/api/dto"
	"server/internal/tbank"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

type TBankHandler struct {
	tbankService *tbank.Service
}

func NewTBankHandler(tbankService *tbank.Service) *TBankHandler {
	return &TBankHandler{tbankService: tbankService}
}

// GetStatus godoc
//
//	@Summary		Get T-Bank integration status
//	@Description	Returns current user T-Bank connection state and available accounts
//	@Tags			tbank
//	@Produce		json
//	@Success		200	{object}	dto.TBankConnectionStatusResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/tbank [get]
func (h *TBankHandler) GetStatus(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	resp, err := h.tbankService.GetStatus(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to load T-Bank status"})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// Connect godoc
//
//	@Summary		Connect T-Bank account
//	@Description	Saves user token/environment and verifies access by loading accounts
//	@Tags			tbank
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		dto.TBankConnectRequest	true	"T-Bank connect payload"
//	@Success		200		{object}	dto.TBankConnectionStatusResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		502		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/tbank/connect [post]
func (h *TBankHandler) Connect(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req dto.TBankConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.Connect(c.Request.Context(), userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, tbank.ErrTBankInvalidEnv), errors.Is(err, tbank.ErrTBankAuthFailed):
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		default:
			c.JSON(http.StatusBadGateway, dto.ErrorResponse{Error: err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, resp)
}

// Disconnect godoc
//
//	@Summary		Disconnect T-Bank account
//	@Description	Removes saved T-Bank credentials for the current user
//	@Tags			tbank
//	@Produce		json
//	@Success		200	{object}	map[string]bool
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/tbank/disconnect [post]
func (h *TBankHandler) Disconnect(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	if err := h.tbankService.Disconnect(userID); err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to disconnect T-Bank"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// SetDefaultAccount godoc
//
//	@Summary		Set T-Bank default account
//	@Description	Sets connected account to use by default for portfolio actions
//	@Tags			tbank
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		dto.TBankSetDefaultAccountRequest	true	"Default account payload"
//	@Success		200		{object}	dto.TBankConnectionStatusResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		502		{object}	dto.ErrorResponse
//	@Router			/me/tbank/default-account [post]
func (h *TBankHandler) SetDefaultAccount(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req dto.TBankSetDefaultAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.SetDefaultAccount(c.Request.Context(), userID, &req)
	if err != nil {
		writeTBankServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// FindInstrumentByTicker godoc
//
//	@Summary		Find T-Bank instrument id by ticker
//	@Description	Resolves T-Bank instrument candidates by MOEX ticker and optional class code
//	@Tags			tbank
//	@Produce		json
//	@Param			ticker		query		string	true	"MOEX ticker"
//	@Param			class_code	query		string	false	"MOEX class code (for exact filtering)"
//	@Success		200			{object}	dto.TBankInstrumentLookupResponse
//	@Failure		400			{object}	dto.ErrorResponse
//	@Failure		502			{object}	dto.ErrorResponse
//	@Router			/me/tbank/instruments/lookup [get]
func (h *TBankHandler) FindInstrumentByTicker(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	ticker := strings.TrimSpace(c.Query("ticker"))
	classCode := strings.TrimSpace(c.Query("class_code"))

	resp, err := h.tbankService.FindInstrumentByTicker(c.Request.Context(), userID, ticker, classCode)
	if err != nil {
		writeTBankServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func writeTBankServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, tbank.ErrTBankNotConnected),
		errors.Is(err, tbank.ErrTBankNoAccountFound),
		errors.Is(err, tbank.ErrTBankAuthFailed),
		errors.Is(err, tbank.ErrTBankInvalidEnv),
		errors.Is(err, tbank.ErrTBankSandboxOnly):
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
	default:
		c.JSON(http.StatusBadGateway, dto.ErrorResponse{Error: err.Error()})
	}
}
