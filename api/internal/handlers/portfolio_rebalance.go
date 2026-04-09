package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"server/internal/api/dto"
	"server/internal/rebalance"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

type PortfolioRebalanceHandler struct {
	service *rebalance.Service
}

func NewPortfolioRebalanceHandler(service *rebalance.Service) *PortfolioRebalanceHandler {
	return &PortfolioRebalanceHandler{service: service}
}

// CreateRebalanceDraft godoc
//
//	@Summary		Create rebalance draft
//	@Description	Creates a persisted rebalance draft (planning only, no execution)
//	@Tags			portfolio
//	@Accept			json
//	@Produce		json
//	@Param			id		path		int							true	"Portfolio profile id"
//	@Param			payload	body		dto.PortfolioRebalanceCreateRequest	true	"Rebalance draft payload"
//	@Success		202		{object}	dto.PortfolioRebalanceDetailResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/rebalances [post]
func (h *PortfolioRebalanceHandler) CreateRebalanceDraft(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	portfolioID, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	var req dto.PortfolioRebalanceCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.service.CreateDraft(c.Request.Context(), userID, portfolioID, &req)
	if err != nil {
		writePortfolioRebalanceError(c, err)
		return
	}
	c.JSON(http.StatusAccepted, resp)
}

// ListRebalances godoc
//
//	@Summary		List rebalance drafts
//	@Description	Lists persisted rebalances for selected portfolio profile
//	@Tags			portfolio
//	@Produce		json
//	@Param			id		path		int	true	"Portfolio profile id"
//	@Param			limit	query		int	false	"Max number of rows"
//	@Success		200		{array}	dto.PortfolioRebalanceRun
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		500		{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/rebalances [get]
func (h *PortfolioRebalanceHandler) ListRebalances(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	portfolioID, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	limit := 50
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid limit"})
			return
		}
		limit = parsed
	}

	rows, err := h.service.ListRuns(c.Request.Context(), userID, portfolioID, limit)
	if err != nil {
		writePortfolioRebalanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, rows)
}

// GetRebalanceDetail godoc
//
//	@Summary		Get rebalance draft detail
//	@Description	Returns run metadata and persisted planning payload (input, output, summary)
//	@Tags			portfolio
//	@Produce		json
//	@Param			id			path		int	true	"Portfolio profile id"
//	@Param			rebalanceId	path		int	true	"Rebalance run id"
//	@Success		200			{object}	dto.PortfolioRebalanceDetailResponse
//	@Failure		400			{object}	dto.ErrorResponse
//	@Failure		404			{object}	dto.ErrorResponse
//	@Failure		500			{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/rebalances/{rebalanceId} [get]
func (h *PortfolioRebalanceHandler) GetRebalanceDetail(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	portfolioID, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	runID, ok := parseRebalanceID(c)
	if !ok {
		return
	}

	resp, err := h.service.GetRunDetail(c.Request.Context(), userID, portfolioID, runID)
	if err != nil {
		writePortfolioRebalanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

// DeleteRebalanceDraft godoc
//
//	@Summary		Delete rebalance draft
//	@Description	Deletes selected rebalance draft and all related records
//	@Tags			portfolio
//	@Param			id			path		int	true	"Portfolio profile id"
//	@Param			rebalanceId	path		int	true	"Rebalance run id"
//	@Success		204
//	@Failure		400	{object}	dto.ErrorResponse
//	@Failure		404	{object}	dto.ErrorResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/rebalances/{rebalanceId} [delete]
func (h *PortfolioRebalanceHandler) DeleteRebalanceDraft(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	portfolioID, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	runID, ok := parseRebalanceID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteDraft(c.Request.Context(), userID, portfolioID, runID); err != nil {
		writePortfolioRebalanceError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// ExecuteRebalance godoc
//
//	@Summary		Execute rebalance draft
//	@Description	Starts Temporal workflow to execute planned rebalance transactions
//	@Tags			portfolio
//	@Param			id			path		int	true	"Portfolio profile id"
//	@Param			rebalanceId	path		int	true	"Rebalance run id"
//	@Success		202			{object}	dto.PortfolioRebalanceRun
//	@Failure		400			{object}	dto.ErrorResponse
//	@Failure		404			{object}	dto.ErrorResponse
//	@Failure		500			{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/rebalances/{rebalanceId}/execute [post]
func (h *PortfolioRebalanceHandler) ExecuteRebalance(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	portfolioID, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	runID, ok := parseRebalanceID(c)
	if !ok {
		return
	}

	resp, err := h.service.ExecuteRun(c.Request.Context(), userID, portfolioID, runID)
	if err != nil {
		writePortfolioRebalanceError(c, err)
		return
	}
	c.JSON(http.StatusAccepted, resp)
}

// GetRebalanceStatus godoc
//
//	@Summary		Get rebalance status
//	@Description	Returns pollable run status with live progress, item statuses, and links
//	@Tags			portfolio
//	@Produce		json
//	@Param			id			path		int	true	"Portfolio profile id"
//	@Param			rebalanceId	path		int	true	"Rebalance run id"
//	@Success		200			{object}	dto.PortfolioRebalanceStatusResponse
//	@Failure		400			{object}	dto.ErrorResponse
//	@Failure		404			{object}	dto.ErrorResponse
//	@Failure		500			{object}	dto.ErrorResponse
//	@Router			/me/portfolios/{id}/rebalances/{rebalanceId}/status [get]
func (h *PortfolioRebalanceHandler) GetRebalanceStatus(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	portfolioID, ok := parsePortfolioID(c)
	if !ok {
		return
	}

	runID, ok := parseRebalanceID(c)
	if !ok {
		return
	}

	resp, err := h.service.GetRunStatus(c.Request.Context(), userID, portfolioID, runID)
	if err != nil {
		writePortfolioRebalanceError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func parseRebalanceID(c *gin.Context) (int, bool) {
	runID, err := strconv.Atoi(strings.TrimSpace(c.Param("rebalanceId")))
	if err != nil || runID <= 0 {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid rebalance id"})
		return 0, false
	}
	return runID, true
}

func writePortfolioRebalanceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, rebalance.ErrInvalidRequest),
		errors.Is(err, rebalance.ErrInvalidAsOfDate),
		errors.Is(err, rebalance.ErrInvalidExecutionMode),
		errors.Is(err, rebalance.ErrInvalidProfileID),
		errors.Is(err, rebalance.ErrInvalidRebalanceID),
		errors.Is(err, rebalance.ErrRebalanceNotExecutable),
		errors.Is(err, rebalance.ErrReplicationConfigDisabled),
		errors.Is(err, rebalance.ErrBenchmarkNotConfigured),
		errors.Is(err, rebalance.ErrProviderNotFound),
		errors.Is(err, rebalance.ErrExecutionProviderUnsupported):
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: err.Error()})
	case errors.Is(err, rebalance.ErrExecutionUnavailable):
		c.JSON(http.StatusServiceUnavailable, dto.ErrorResponse{Error: err.Error()})
	case errors.Is(err, rebalance.ErrPlanningUnavailable):
		c.JSON(http.StatusServiceUnavailable, dto.ErrorResponse{Error: err.Error()})
	case errors.Is(err, rebalance.ErrProfileNotFound),
		errors.Is(err, rebalance.ErrReplicationConfigNotFound),
		errors.Is(err, rebalance.ErrBenchmarkNotFound),
		errors.Is(err, rebalance.ErrRebalanceNotFound),
		errors.Is(err, rebalance.ErrExecutionNotFound):
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: err.Error()})
	default:
		log.Printf("portfolio rebalance request failed: %v", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Rebalance request failed"})
	}
}
