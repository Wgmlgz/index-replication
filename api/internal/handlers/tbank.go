package handlers

import (
	"errors"
	"net/http"
	"strconv"
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

// CreateTestBuyOrder godoc
//
//	@Summary		Create T-Bank test buy order
//	@Description	Places a market buy order using the connected user T-Bank account
//	@Tags			tbank
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		dto.TBankTestBuyRequest	true	"T-Bank test buy payload"
//	@Success		200		{object}	dto.TBankTestBuyResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		502		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/tbank/test-buy [post]
func (h *TBankHandler) CreateTestBuyOrder(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req dto.TBankTestBuyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.CreateTestBuyOrder(c.Request.Context(), userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, tbank.ErrTBankNotConnected),
			errors.Is(err, tbank.ErrTBankNoAccountFound),
			errors.Is(err, tbank.ErrTBankAuthFailed),
			errors.Is(err, tbank.ErrTBankInvalidEnv):
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		default:
			c.JSON(http.StatusBadGateway, dto.ErrorResponse{Error: err.Error()})
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

// GetAccountPortfolio godoc
//
//	@Summary		Get T-Bank account balances and portfolio
//	@Description	Returns balances and positions for selected account (or default account if omitted)
//	@Tags			tbank
//	@Produce		json
//	@Param			account_id	query		string	false	"Account id"
//	@Success		200			{object}	dto.TBankAccountPortfolioResponse
//	@Failure		400			{object}	dto.ErrorResponse
//	@Failure		502			{object}	dto.ErrorResponse
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

// GetOperationsHistory godoc
//
//	@Summary		Get T-Bank account operations history
//	@Description	Returns executed account operations (buy/sell/etc.) with cursor pagination
//	@Tags			tbank
//	@Produce		json
//	@Param			account_id	query		string	false	"Account id"
//	@Param			cursor		query		string	false	"Cursor from previous response"
//	@Param			limit		query		int		false	"Page size (1-200, default 50)"
//	@Success		200			{object}	dto.TBankOperationsHistoryResponse
//	@Failure		400			{object}	dto.ErrorResponse
//	@Failure		502			{object}	dto.ErrorResponse
//	@Router			/me/tbank/operations [get]
func (h *TBankHandler) GetOperationsHistory(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	accountID := strings.TrimSpace(c.Query("account_id"))
	cursor := strings.TrimSpace(c.Query("cursor"))

	limit := int32(50)
	limitQuery := strings.TrimSpace(c.Query("limit"))
	if limitQuery != "" {
		parsedLimit, err := strconv.Atoi(limitQuery)
		if err != nil || parsedLimit < 1 {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid limit query value"})
			return
		}
		if parsedLimit > 200 {
			parsedLimit = 200
		}
		limit = int32(parsedLimit)
	}

	resp, err := h.tbankService.GetOperationsHistory(c.Request.Context(), userID, accountID, cursor, limit)
	if err != nil {
		writeTBankServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GetPortfolioHistory godoc
//
//	@Summary		Get T-Bank operation-derived portfolio history
//	@Description	Returns portfolio history reconstructed from operations and current portfolio positions.
//	@Tags			tbank
//	@Produce		json
//	@Param			account_id		query		string	false	"Account id"
//	@Param			from			query		string	false	"Start date (YYYY-MM-DD)"
//	@Param			till			query		string	false	"End date (YYYY-MM-DD)"
//	@Param			intervalDays	query		int		false	"Downsample interval in days"
//	@Success		200				{array}		dto.TBankPortfolioHistoryPoint
//	@Failure		400				{object}	dto.ErrorResponse
//	@Failure		502				{object}	dto.ErrorResponse
//	@Router			/me/tbank/portfolio/history [get]
func (h *TBankHandler) GetPortfolioHistory(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	accountID := strings.TrimSpace(c.Query("account_id"))

	from, till, err := normalizeDateRange(c.Query("from"), c.Query("till"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		return
	}

	intervalDays, err := parseIntervalDays(c.Query("intervalDays"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		return
	}

	resp, err := h.tbankService.GetPortfolioHistory(c.Request.Context(), userID, accountID, from, till, intervalDays)
	if err != nil {
		writeTBankServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GetPortfolioComposition godoc
//
//	@Summary		Get T-Bank operation-derived portfolio composition snapshot
//	@Description	Returns reconstructed composition snapshot for requested date (or latest).
//	@Tags			tbank
//	@Produce		json
//	@Param			account_id	query		string	false	"Account id"
//	@Param			date		query		string	false	"Snapshot date (YYYY-MM-DD)"
//	@Success		200			{array}		dto.TBankPortfolioCompositionEntry
//	@Failure		400			{object}	dto.ErrorResponse
//	@Failure		502			{object}	dto.ErrorResponse
//	@Router			/me/tbank/portfolio/composition [get]
func (h *TBankHandler) GetPortfolioComposition(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	accountID := strings.TrimSpace(c.Query("account_id"))
	date := strings.TrimSpace(c.Query("date"))
	if date != "" && !isValidDate(date) {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid date format"})
		return
	}

	resp, err := h.tbankService.GetPortfolioComposition(c.Request.Context(), userID, accountID, date)
	if err != nil {
		writeTBankServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GetPortfolioCompositionSeries godoc
//
//	@Summary		Get T-Bank operation-derived portfolio composition series
//	@Description	Returns downsampled composition weight series reconstructed from operations and current holdings.
//	@Tags			tbank
//	@Produce		json
//	@Param			account_id		query		string	false	"Account id"
//	@Param			tickers			query		string	false	"Comma-separated list of tickers"
//	@Param			topCount		query		int		false	"When tickers are omitted: number of top constituents (0 = all, default 10)"
//	@Param			selectionMode	query		string	false	"Ticker auto-selection mode: fixed|rolling (default fixed)"
//	@Param			selectionDate	query		string	false	"Top selection date for fixed mode (YYYY-MM-DD)"
//	@Param			from			query		string	false	"Start date (YYYY-MM-DD)"
//	@Param			till			query		string	false	"End date (YYYY-MM-DD)"
//	@Param			intervalDays	query		int		false	"Downsample interval in days"
//	@Success		200				{object}	map[string][]dto.TBankPortfolioCompositionSeriesPoint
//	@Failure		400				{object}	dto.ErrorResponse
//	@Failure		502				{object}	dto.ErrorResponse
//	@Router			/me/tbank/portfolio/composition/series [get]
func (h *TBankHandler) GetPortfolioCompositionSeries(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	accountID := strings.TrimSpace(c.Query("account_id"))

	tickersParam := strings.TrimSpace(c.Query("tickers"))
	tickerParts := strings.Split(tickersParam, ",")
	tickers := make([]string, 0, len(tickerParts))
	for _, item := range tickerParts {
		ticker := strings.TrimSpace(item)
		if ticker == "" {
			continue
		}
		tickers = append(tickers, ticker)
	}

	topCount, err := parseTopCount(c.Query("topCount"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		return
	}
	selectionMode, err := parseCompositionSelectionMode(c.Query("selectionMode"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		return
	}
	selectionDate := strings.TrimSpace(c.Query("selectionDate"))
	if selectionDate != "" && !isValidDate(selectionDate) {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid selectionDate"})
		return
	}

	from, till, err := normalizeDateRange(c.Query("from"), c.Query("till"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		return
	}
	intervalDays, err := parseIntervalDays(c.Query("intervalDays"))
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
		return
	}

	resp, err := h.tbankService.GetPortfolioCompositionSeries(
		c.Request.Context(),
		userID,
		accountID,
		tickers,
		topCount,
		selectionMode,
		selectionDate,
		from,
		till,
		intervalDays,
	)
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
//	@Param			payload	body		dto.TBankSandboxPayInRequest	true	"Sandbox pay-in payload"
//	@Success		200		{object}	dto.TBankSandboxPayInResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		502		{object}	dto.ErrorResponse
//	@Router			/me/tbank/sandbox/pay-in [post]
func (h *TBankHandler) SandboxPayIn(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req dto.TBankSandboxPayInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
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
