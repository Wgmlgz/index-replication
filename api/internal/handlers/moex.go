package handlers

import (
	"errors"
	"net/http"
	"server/internal/models"
	"server/internal/services"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type MoexHandler struct {
	service *services.MoexReadService
}

func NewMoexHandler(service *services.MoexReadService) *MoexHandler {
	return &MoexHandler{service: service}
}

// GetMoexOverview godoc
//
//	@Summary		Get MOEX indexes overview
//	@Description	Returns indexes list, collections, and membership map
//	@Tags			moex
//	@Produce		json
//	@Param			lang	query		string	false	"Response language (ru/en)"
//	@Success		200		{object}	models.MoexIndexesOverviewResponse
//	@Failure		500		{object}	models.ErrorResponse
//	@Router			/moex/indexes/overview [get]
func (h *MoexHandler) GetMoexOverview(c *gin.Context) {
	lang := strings.TrimSpace(c.Query("lang"))
	overview, err := h.service.GetIndexesOverview(c.Request.Context(), lang)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch MOEX overview"})
		return
	}
	c.JSON(http.StatusOK, overview)
}

// GetMoexIndexHistory godoc
//
//	@Summary		Get MOEX index history
//	@Description	Returns downsampled history for a MOEX index
//	@Tags			moex
//	@Produce		json
//	@Param			secid			path		string	true	"Index SECID"
//	@Param			from			query		string	false	"Start date (YYYY-MM-DD)"
//	@Param			till			query		string	false	"End date (YYYY-MM-DD)"
//	@Param			intervalDays	query		int		false	"Downsample interval in days"
//	@Success		200				{array}		models.MoexIndexHistoryPoint
//	@Failure		400				{object}	models.ErrorResponse
//	@Failure		500				{object}	models.ErrorResponse
//	@Router			/moex/indexes/{secid}/history [get]
func (h *MoexHandler) GetMoexIndexHistory(c *gin.Context) {
	secid := strings.TrimSpace(c.Param("secid"))
	if secid == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Missing secid"})
		return
	}

	from, till, err := normalizeDateRange(c.Query("from"), c.Query("till"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	intervalDays, err := parseIntervalDays(c.Query("intervalDays"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	points, coverage, err := h.service.GetIndexHistory(c.Request.Context(), secid, from, till, intervalDays)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch MOEX history"})
		return
	}
	applyCoverageHeaders(c, coverage)
	c.JSON(http.StatusOK, points)
}

// GetMoexIndexComposition godoc
//
//	@Summary		Get MOEX index composition
//	@Description	Returns index composition snapshot
//	@Tags			moex
//	@Produce		json
//	@Param			secid	path		string	true	"Index SECID"
//	@Param			date	query		string	false	"Snapshot date (YYYY-MM-DD)"
//	@Param			lang	query		string	false	"Response language (ru/en)"
//	@Success		200		{array}		models.MoexIndexCompositionEntry
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		500		{object}	models.ErrorResponse
//	@Router			/moex/indexes/{secid}/composition [get]
func (h *MoexHandler) GetMoexIndexComposition(c *gin.Context) {
	secid := strings.TrimSpace(c.Param("secid"))
	if secid == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Missing secid"})
		return
	}

	date := strings.TrimSpace(c.Query("date"))
	if date != "" && !isValidDate(date) {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid date format"})
		return
	}
	lang := strings.TrimSpace(c.Query("lang"))

	rows, coverage, err := h.service.GetIndexComposition(c.Request.Context(), secid, date, lang)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch MOEX composition"})
		return
	}
	applyCoverageHeaders(c, coverage)
	c.JSON(http.StatusOK, rows)
}

// GetMoexIndexCompositionSeries godoc
//
//	@Summary		Get MOEX index composition series
//	@Description	Returns downsampled weight series for index tickers
//	@Tags			moex
//	@Produce		json
//	@Param			secid			path		string	true	"Index SECID"
//	@Param			tickers			query		string	false	"Comma-separated list of tickers (optional; backend can pick top constituents)"
//	@Param			topCount		query		int		false	"When tickers are omitted: number of top constituents by latest snapshot (0 = all, default 10)"
//	@Param			selectionMode	query		string	false	"Ticker auto-selection mode when tickers are omitted: fixed|rolling (default fixed)"
//	@Param			selectionDate	query		string	false	"Top selection date for fixed mode (YYYY-MM-DD, default till/today)"
//	@Param			from			query		string	false	"Start date (YYYY-MM-DD)"
//	@Param			till			query		string	false	"End date (YYYY-MM-DD)"
//	@Param			intervalDays	query		int		false	"Downsample interval in days"
//	@Param			lang			query		string	false	"Response language (ru/en)"
//	@Success		200				{object}	map[string][]models.MoexIndexTickerAnalyticsPoint
//	@Failure		400				{object}	models.ErrorResponse
//	@Failure		500				{object}	models.ErrorResponse
//	@Router			/moex/indexes/{secid}/composition/series [get]
func (h *MoexHandler) GetMoexIndexCompositionSeries(c *gin.Context) {
	secid := strings.TrimSpace(c.Param("secid"))
	if secid == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Missing secid"})
		return
	}

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
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}
	selectionMode, err := parseCompositionSelectionMode(c.Query("selectionMode"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}
	selectionDate := strings.TrimSpace(c.Query("selectionDate"))
	if selectionDate != "" && !isValidDate(selectionDate) {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid selectionDate"})
		return
	}

	from, till, err := normalizeDateRange(c.Query("from"), c.Query("till"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	intervalDays, err := parseIntervalDays(c.Query("intervalDays"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		return
	}

	lang := strings.TrimSpace(c.Query("lang"))

	result, coverage, err := h.service.GetIndexCompositionSeries(c.Request.Context(), secid, tickers, topCount, selectionMode, selectionDate, from, till, intervalDays, lang)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch MOEX composition series"})
		return
	}
	applyCoverageHeaders(c, coverage)
	c.JSON(http.StatusOK, result)
}

func parseIntervalDays(value string) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, nil
	}
	for i, r := range value {
		if r < '0' || r > '9' {
			value = value[:i]
			break
		}
	}
	if value == "" {
		return 0, errors.New("Invalid intervalDays")
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, errors.New("Invalid intervalDays")
	}
	return parsed, nil
}

func parseTopCount(value string) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 10, nil
	}
	for i, r := range value {
		if r < '0' || r > '9' {
			value = value[:i]
			break
		}
	}
	if value == "" {
		return 0, errors.New("Invalid topCount")
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 0 {
		return 0, errors.New("Invalid topCount")
	}
	return parsed, nil
}

func parseCompositionSelectionMode(value string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return "fixed", nil
	}
	switch normalized {
	case "fixed", "rolling":
		return normalized, nil
	default:
		return "", errors.New("Invalid selectionMode")
	}
}

func normalizeDateRange(from, till string) (string, string, error) {
	from = strings.TrimSpace(from)
	till = strings.TrimSpace(till)
	if from != "" && !isValidDate(from) {
		return "", "", errors.New("Invalid from date")
	}
	if till != "" && !isValidDate(till) {
		return "", "", errors.New("Invalid till date")
	}
	if from != "" && till != "" && from > till {
		return till, from, nil
	}
	return from, till, nil
}

func isValidDate(value string) bool {
	_, err := time.Parse("2006-01-02", value)
	return err == nil
}

func applyCoverageHeaders(c *gin.Context, coverage *services.MoexCoverageMeta) {
	if coverage == nil {
		return
	}
	c.Header("X-MOEX-Coverage-Status", coverage.Status)
	c.Header("X-MOEX-Coverage-Dataset", coverage.Dataset)
	c.Header("X-MOEX-Coverage-Entity", coverage.EntityKey)
	if coverage.RequestedFrom != "" {
		c.Header("X-MOEX-Coverage-From", coverage.RequestedFrom)
	}
	if coverage.RequestedTill != "" {
		c.Header("X-MOEX-Coverage-Till", coverage.RequestedTill)
	}
	if len(coverage.MissingRanges) > 0 {
		parts := make([]string, 0, len(coverage.MissingRanges))
		for _, rng := range coverage.MissingRanges {
			parts = append(parts, rng.FromDate.UTC().Format("2006-01-02")+":"+rng.ToDate.UTC().Format("2006-01-02"))
		}
		c.Header("X-MOEX-Coverage-Missing", strings.Join(parts, ","))
	}
}
