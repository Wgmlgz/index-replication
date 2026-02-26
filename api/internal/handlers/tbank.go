package handlers

import (
	"errors"
	"net/http"
	"strings"

	"server/internal/models"
	"server/internal/services"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

type TBankHandler struct {
	tbankService *services.TBankService
}

func NewTBankHandler(tbankService *services.TBankService) *TBankHandler {
	return &TBankHandler{tbankService: tbankService}
}

// GetStatus godoc
//
//	@Summary		Get T-Bank integration status
//	@Description	Returns current user T-Bank connection state and available accounts
//	@Tags			tbank
//	@Produce		json
//	@Success		200	{object}	models.TBankConnectionStatusResponse
//	@Failure		500	{object}	models.ErrorResponse
//	@Router			/me/tbank [get]
func (h *TBankHandler) GetStatus(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	resp, err := h.tbankService.GetStatus(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to load T-Bank status"})
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
//	@Param			payload	body		models.TBankConnectRequest	true	"T-Bank connect payload"
//	@Success		200		{object}	models.TBankConnectionStatusResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		502		{object}	models.ErrorResponse
//	@Failure		500		{object}	models.ErrorResponse
//	@Router			/me/tbank/connect [post]
func (h *TBankHandler) Connect(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req models.TBankConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.Connect(c.Request.Context(), userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrTBankInvalidEnv), errors.Is(err, services.ErrTBankAuthFailed):
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		default:
			c.JSON(http.StatusBadGateway, models.ErrorResponse{Error: err.Error()})
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
//	@Failure		500	{object}	models.ErrorResponse
//	@Router			/me/tbank/disconnect [post]
func (h *TBankHandler) Disconnect(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	if err := h.tbankService.Disconnect(userID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to disconnect T-Bank"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// CreateTestBuyOrder godoc
//
//	@Summary		Create T-Bank test buy order
//	@Description	Places a market buy order using the connected user T-Bank account
//	@Tags			tbank
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		models.TBankTestBuyRequest	true	"T-Bank test buy payload"
//	@Success		200		{object}	models.TBankTestBuyResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		502		{object}	models.ErrorResponse
//	@Failure		500		{object}	models.ErrorResponse
//	@Router			/me/tbank/test-buy [post]
func (h *TBankHandler) CreateTestBuyOrder(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req models.TBankTestBuyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.CreateTestBuyOrder(c.Request.Context(), userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrTBankNotConnected),
			errors.Is(err, services.ErrTBankNoAccountFound),
			errors.Is(err, services.ErrTBankAuthFailed),
			errors.Is(err, services.ErrTBankInvalidEnv):
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		default:
			c.JSON(http.StatusBadGateway, models.ErrorResponse{Error: err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, resp)
}

// SetDefaultAccount godoc
//
//	@Summary		Set T-Bank default account
//	@Description	Sets connected account to use by default for test-buy and portfolio actions
//	@Tags			tbank
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		models.TBankSetDefaultAccountRequest	true	"Default account payload"
//	@Success		200		{object}	models.TBankConnectionStatusResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		502		{object}	models.ErrorResponse
//	@Router			/me/tbank/default-account [post]
func (h *TBankHandler) SetDefaultAccount(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req models.TBankSetDefaultAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.SetDefaultAccount(c.Request.Context(), userID, &req)
	if err != nil {
		writeTBankServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GetAccountPortfolio godoc
//
//	@Summary		Get T-Bank account balances and portfolio
//	@Description	Returns balances and positions for selected account (or default account if omitted)
//	@Tags			tbank
//	@Produce		json
//	@Param			account_id	query		string	false	"Account id"
//	@Success		200			{object}	models.TBankAccountPortfolioResponse
//	@Failure		400			{object}	models.ErrorResponse
//	@Failure		502			{object}	models.ErrorResponse
//	@Router			/me/tbank/portfolio [get]
func (h *TBankHandler) GetAccountPortfolio(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	accountID := strings.TrimSpace(c.Query("account_id"))

	resp, err := h.tbankService.GetAccountPortfolio(c.Request.Context(), userID, accountID)
	if err != nil {
		writeTBankServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// SandboxPayIn godoc
//
//	@Summary		Top up T-Bank sandbox account
//	@Description	Adds virtual money to selected sandbox account
//	@Tags			tbank
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		models.TBankSandboxPayInRequest	true	"Sandbox pay-in payload"
//	@Success		200		{object}	models.TBankSandboxPayInResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		502		{object}	models.ErrorResponse
//	@Router			/me/tbank/sandbox/pay-in [post]
func (h *TBankHandler) SandboxPayIn(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req models.TBankSandboxPayInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.SandboxPayIn(c.Request.Context(), userID, &req)
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
//	@Success		200			{object}	models.TBankInstrumentLookupResponse
//	@Failure		400			{object}	models.ErrorResponse
//	@Failure		502			{object}	models.ErrorResponse
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
	case errors.Is(err, services.ErrTBankNotConnected),
		errors.Is(err, services.ErrTBankNoAccountFound),
		errors.Is(err, services.ErrTBankAuthFailed),
		errors.Is(err, services.ErrTBankInvalidEnv),
		errors.Is(err, services.ErrTBankSandboxOnly):
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
	default:
		c.JSON(http.StatusBadGateway, models.ErrorResponse{Error: err.Error()})
	}
}
