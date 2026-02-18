package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"server/internal/models"
	"server/internal/repository"

	"github.com/gin-gonic/gin"
)

type MoexSyncAdminHandler struct {
	repo *repository.MoexDataRepository
}

func NewMoexSyncAdminHandler(repo *repository.MoexDataRepository) *MoexSyncAdminHandler {
	return &MoexSyncAdminHandler{repo: repo}
}

// GetMoexSyncState godoc
//
//	@Summary		Get MOEX sync state rows
//	@Description	Returns rows from moex_sync_state with optional filters
//	@Tags			moex
//	@Produce		json
//	@Param			dataset		query		string	false	"Dataset filter"
//	@Param			entityKey	query		string	false	"Entity key filter"
//	@Param			limit		query		int		false	"Result limit"
//	@Success		200			{array}		repository.MoexSyncStateRow
//	@Failure		500			{object}	models.ErrorResponse
//	@Router			/moex/sync/state [get]
func (h *MoexSyncAdminHandler) GetMoexSyncState(c *gin.Context) {
	limit := parsePositiveInt(c.Query("limit"), 200)
	rows, err := h.repo.ListSyncState(c.Request.Context(), c.Query("dataset"), c.Query("entityKey"), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch MOEX sync state"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

// GetMoexCoverage godoc
//
//	@Summary		Get MOEX coverage rows
//	@Description	Returns rows from moex_data_coverage with optional filters
//	@Tags			moex
//	@Produce		json
//	@Param			dataset		query		string	false	"Dataset filter"
//	@Param			entityKey	query		string	false	"Entity key filter"
//	@Param			from		query		string	false	"From date (YYYY-MM-DD)"
//	@Param			till		query		string	false	"Till date (YYYY-MM-DD)"
//	@Param			limit		query		int		false	"Result limit"
//	@Success		200			{array}		repository.MoexCoverageRow
//	@Failure		400			{object}	models.ErrorResponse
//	@Failure		500			{object}	models.ErrorResponse
//	@Router			/moex/sync/coverage [get]
func (h *MoexSyncAdminHandler) GetMoexCoverage(c *gin.Context) {
	fromDate, err := parseOptionalDate(c.Query("from"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid from date"})
		return
	}
	tillDate, err := parseOptionalDate(c.Query("till"))
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid till date"})
		return
	}

	limit := parsePositiveInt(c.Query("limit"), 500)
	rows, err := h.repo.ListCoverage(c.Request.Context(), c.Query("dataset"), c.Query("entityKey"), fromDate, tillDate, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch MOEX coverage"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

// GetMoexSyncRuns godoc
//
//	@Summary		Get MOEX sync run history
//	@Description	Returns rows from moex_sync_runs with optional filters
//	@Tags			moex
//	@Produce		json
//	@Param			dataset		query		string	false	"Dataset filter"
//	@Param			entityKey	query		string	false	"Entity key filter"
//	@Param			status		query		string	false	"Status filter"
//	@Param			limit		query		int		false	"Result limit"
//	@Success		200			{array}		repository.MoexSyncRunRow
//	@Failure		500			{object}	models.ErrorResponse
//	@Router			/moex/sync/runs [get]
func (h *MoexSyncAdminHandler) GetMoexSyncRuns(c *gin.Context) {
	limit := parsePositiveInt(c.Query("limit"), 500)
	rows, err := h.repo.ListSyncRuns(c.Request.Context(), c.Query("dataset"), c.Query("entityKey"), c.Query("status"), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to fetch MOEX sync runs"})
		return
	}
	c.JSON(http.StatusOK, rows)
}

func parsePositiveInt(value string, fallback int) int {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func parseOptionalDate(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, err
	}
	utc := parsed.UTC()
	dateOnly := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
	return &dateOnly, nil
}
