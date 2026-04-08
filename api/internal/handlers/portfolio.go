package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"server/internal/api/dto"
	"server/internal/portfolio"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

type PortfolioHandler struct {
	service *portfolio.Service
}

func NewPortfolioHandler(service *portfolio.Service) *PortfolioHandler {
	return &PortfolioHandler{service: service}
}

// ListProfiles godoc
//
//	@Summary		List portfolio profiles
//	@Description	Returns current user portfolio profiles with provider capabilities
//	@Tags			portfolio
//	@Produce		json
//	@Success		200	{array}		dto.PortfolioProfile
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/portfolios [get]
func (h *PortfolioHandler) ListProfiles(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	profiles, err := h.service.ListProfiles(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Failed to load portfolio profiles"})
		return
	}
	c.JSON(http.StatusOK, profiles)
}

// CreateProfile godoc
//
//	@Summary		Create portfolio profile
//	@Description	Creates provider-backed portfolio profile for the current user
//	@Tags			portfolio
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		dto.PortfolioProfileCreateRequest	true	"Portfolio profile payload"
//	@Success		201		{object}	dto.PortfolioProfile
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/portfolios [post]
func (h *PortfolioHandler) CreateProfile(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req dto.PortfolioProfileCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.service.CreateProfile(c.Request.Context(), userID, &req)
	if err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, resp)
}

// PatchProfile godoc
//
//	@Summary		Update portfolio profile
//	@Description	Updates selected portfolio profile (name/default/config/secret)
//	@Tags			portfolio
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int								true	"Portfolio profile id"
//	@Param			payload	body		dto.PortfolioProfilePatchRequest	true	"Portfolio profile patch payload"
//	@Success		200		{object}	dto.PortfolioProfile
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id} [patch]
func (h *PortfolioHandler) PatchProfile(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	var req dto.PortfolioProfilePatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.service.PatchProfile(c.Request.Context(), userID, id, &req)
	if err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// DeleteProfile godoc
//
//	@Summary		Delete portfolio profile
//	@Description	Deletes selected portfolio profile
//	@Tags			portfolio
//	@Param			id	path	int	true	"Portfolio profile id"
//	@Success		204
//	@Failure		400	{object}	dto.ErrorResponse
//	@Failure		404	{object}	dto.ErrorResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id} [delete]
func (h *PortfolioHandler) DeleteProfile(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteProfile(userID, id); err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// UpsertReplicationConfig godoc
//
//	@Summary		Upsert portfolio replication config
//	@Description	Creates or updates replication config for selected portfolio profile
//	@Tags			portfolio
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int											true	"Portfolio profile id"
//	@Param			payload	body		dto.PortfolioReplicationConfigUpsertRequest	true	"Replication config payload"
//	@Success		200		{object}	dto.PortfolioReplicationConfig
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/replication [put]
func (h *PortfolioHandler) UpsertReplicationConfig(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	var req dto.PortfolioReplicationConfigUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.service.UpsertReplicationConfig(userID, id, &req)
	if err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// DeleteReplicationConfig godoc
//
//	@Summary		Delete portfolio replication config
//	@Description	Deletes replication config for selected portfolio profile
//	@Tags			portfolio
//	@Param			id	path	int	true	"Portfolio profile id"
//	@Success		204
//	@Failure		400	{object}	dto.ErrorResponse
//	@Failure		404	{object}	dto.ErrorResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/replication [delete]
func (h *PortfolioHandler) DeleteReplicationConfig(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteReplicationConfig(userID, id); err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// GetSummary godoc
//
//	@Summary		Get portfolio summary
//	@Description	Returns unified summary (balances and positions) by portfolio profile
//	@Tags			portfolio
//	@Produce		json
//	@Param			id	path		int	true	"Portfolio profile id"
//	@Success		200	{object}	dto.PortfolioSummaryResponse
//	@Failure		400	{object}	dto.ErrorResponse
//	@Failure		404	{object}	dto.ErrorResponse
//	@Failure		502	{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/summary [get]
func (h *PortfolioHandler) GetSummary(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	resp, err := h.service.GetSummary(c.Request.Context(), userID, id)
	if err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GetHistory godoc
//
//	@Summary		Get portfolio history
//	@Description	Returns history points for selected portfolio profile
//	@Tags			portfolio
//	@Produce		json
//	@Param			id				path		int		true	"Portfolio profile id"
//	@Param			from			query		string	false	"Start date (YYYY-MM-DD)"
//	@Param			till			query		string	false	"End date (YYYY-MM-DD)"
//	@Param			intervalDays	query		int		false	"Downsample interval in days"
//	@Success		200				{array}		dto.PortfolioHistoryPoint
//	@Failure		400				{object}	dto.ErrorResponse
//	@Failure		404				{object}	dto.ErrorResponse
//	@Failure		502				{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/history [get]
func (h *PortfolioHandler) GetHistory(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
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

	resp, svcErr := h.service.GetHistory(c.Request.Context(), userID, id, from, till, intervalDays)
	if svcErr != nil {
		writePortfolioServiceError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GetComposition godoc
//
//	@Summary		Get portfolio composition snapshot
//	@Description	Returns composition snapshot for selected portfolio profile
//	@Tags			portfolio
//	@Produce		json
//	@Param			id		path		int		true	"Portfolio profile id"
//	@Param			date	query		string	false	"Snapshot date (YYYY-MM-DD)"
//	@Success		200		{array}		dto.PortfolioCompositionEntry
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		502		{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/composition [get]
func (h *PortfolioHandler) GetComposition(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	date := strings.TrimSpace(c.Query("date"))
	if date != "" && !isValidDate(date) {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid date format"})
		return
	}

	resp, err := h.service.GetComposition(c.Request.Context(), userID, id, date)
	if err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GetCompositionSeries godoc
//
//	@Summary		Get portfolio composition series
//	@Description	Returns ticker composition series for selected portfolio profile
//	@Tags			portfolio
//	@Produce		json
//	@Param			id				path		int		true	"Portfolio profile id"
//	@Param			tickers			query		string	false	"Comma-separated tickers"
//	@Param			topCount		query		int		false	"Top constituents count (0 = all)"
//	@Param			selectionMode	query		string	false	"Ticker selection mode: fixed|rolling"
//	@Param			selectionDate	query		string	false	"Selection date (YYYY-MM-DD)"
//	@Param			from			query		string	false	"Start date (YYYY-MM-DD)"
//	@Param			till			query		string	false	"End date (YYYY-MM-DD)"
//	@Param			intervalDays	query		int		false	"Downsample interval in days"
//	@Success		200				{object}	map[string][]dto.PortfolioCompositionSeriesPoint
//	@Failure		400				{object}	dto.ErrorResponse
//	@Failure		404				{object}	dto.ErrorResponse
//	@Failure		502				{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/composition/series [get]
func (h *PortfolioHandler) GetCompositionSeries(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	tickersParam := c.Query("tickers")
	tickers := make([]string, 0)
	for _, item := range strings.Split(tickersParam, ",") {
		ticker := item
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

	resp, svcErr := h.service.GetCompositionSeries(
		c.Request.Context(),
		userID,
		id,
		tickers,
		topCount,
		selectionMode,
		selectionDate,
		from,
		till,
		intervalDays,
	)
	if svcErr != nil {
		writePortfolioServiceError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// GetOperations godoc
//
//	@Summary		Get portfolio operations
//	@Description	Returns portfolio operations history with cursor pagination
//	@Tags			portfolio
//	@Produce		json
//	@Param			id		path		int		true	"Portfolio profile id"
//	@Param			cursor	query		string	false	"Cursor from previous response"
//	@Param			limit	query		int		false	"Page size (1-200, default 50)"
//	@Success		200		{object}	dto.PortfolioOperationsHistoryResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		502		{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/operations [get]
func (h *PortfolioHandler) GetOperations(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	cursor := strings.TrimSpace(c.Query("cursor"))
	limit := int32(50)
	limitValue := strings.TrimSpace(c.Query("limit"))
	if limitValue != "" {
		parsed, err := strconv.Atoi(limitValue)
		if err != nil || parsed < 1 {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid limit query value"})
			return
		}
		if parsed > 200 {
			parsed = 200
		}
		limit = int32(parsed)
	}

	resp, err := h.service.GetOperations(c.Request.Context(), userID, id, cursor, limit)
	if err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// RunAction godoc
//
//	@Summary		Run provider action
//	@Description	Executes provider-specific action for selected portfolio profile
//	@Tags			portfolio
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int							true	"Portfolio profile id"
//	@Param			action	path		string						true	"Provider action id"
//	@Param			payload	body		dto.PortfolioActionRequest	false	"Action payload"
//	@Success		200		{object}	dto.PortfolioActionResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		502		{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/actions/{action} [post]
func (h *PortfolioHandler) RunAction(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	id, ok := parsePortfolioID(c)
	if !ok {
		return
	}
	action := strings.TrimSpace(c.Param("action"))

	var req dto.PortfolioActionRequest
	if err := c.ShouldBindJSON(&req); err != nil && c.Request.ContentLength > 0 {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.service.RunAction(c.Request.Context(), userID, id, action, req.Payload)
	if err != nil {
		writePortfolioServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func parsePortfolioID(c *gin.Context) (int, bool) {
	idValue := strings.TrimSpace(c.Param("id"))
	id, err := strconv.Atoi(idValue)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid portfolio id"})
		return 0, false
	}
	return id, true
}

func writePortfolioServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, portfolio.ErrInvalidProfileID), errors.Is(err, portfolio.ErrInvalidProvider), errors.Is(err, portfolio.ErrInvalidRequest), errors.Is(err, portfolio.ErrInvalidAction), errors.Is(err, portfolio.ErrInvalidBenchmark):
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid portfolio request"})
	case errors.Is(err, portfolio.ErrProfileNotFound):
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "Portfolio profile not found"})
	case errors.Is(err, portfolio.ErrProviderFailed):
		c.JSON(http.StatusBadGateway, dto.ErrorResponse{Error: "Portfolio provider request failed"})
	default:
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Portfolio request failed"})
	}
}
