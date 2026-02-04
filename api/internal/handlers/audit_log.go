package handlers

import (
	"fmt"
	"net/http"
	"server/internal/config"
	"server/internal/models"
	"server/internal/repository"
	"server/internal/services"
	"time"

	"github.com/gin-gonic/gin"
)

type AuditLogHandler struct {
	repo *repository.AuditLogRepository
	cfg  *config.Config
	cs   *services.CasbinService
}

func NewAuditLogHandler(
	repo *repository.AuditLogRepository,
	cfg *config.Config,
	cs *services.CasbinService,
) *AuditLogHandler {
	return &AuditLogHandler{
		repo: repo,
		cfg:  cfg,
		cs:   cs,
	}
}

// ListAuditLogs godoc
//
//	@Summary		List audit logs
//	@Description	Returns a paginated list of audit logs with filters
//	@Tags			audit-logs
//	@Produce		json
//	@Param			page			query		int		false	"Page number"
//	@Param			page_size		query		int		false	"Page size"
//	@Param			search			query		string	false	"Search term"
//	@Param			action			query		string	false	"Action filter"
//	@Param			entity_type		query		string	false	"Entity type filter"
//	@Param			entity_id		query		string	false	"Entity id filter"
//	@Param			performed_by	query		int		false	"Performed by user ID filter"
//	@Param			start_date		query		string	false	"Start date (RFC3339)"
//	@Param			end_date		query		string	false	"End date (RFC3339)"
//	@Success		200				{object}	models.AuditLogListResponse
//	@Failure		500				{object}	models.ErrorResponse
//	@Router			/audit-logs [get]
func (h *AuditLogHandler) ListAuditLogs(c *gin.Context) {
	// Pagination
	page := 1
	pageSize := 50
	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
		if page < 1 {
			page = 1
		}
	}
	if ps := c.Query("page_size"); ps != "" {
		fmt.Sscanf(ps, "%d", &pageSize)
		if pageSize < 1 || pageSize > 200 {
			pageSize = 50
		}
	}

	// Search and filters
	search := c.Query("search")
	action := c.Query("action")
	entityType := c.Query("entity_type")
	entityId := c.Query("entity_id")
	performedBy := c.Query("performed_by")

	var startDate *time.Time
	if c.Query("start_date") != "" {
		if start, err := time.Parse(time.RFC3339, c.Query("start_date")); err == nil {
			startDate = &start
		}
	}
	var endDate *time.Time
	if c.Query("end_date") != "" {
		if start, err := time.Parse(time.RFC3339, c.Query("end_date")); err == nil {
			startDate = &start
		}
	}

	auditLogs, total, err := h.repo.ListAuditLogs(
		page, pageSize, search, action, entityType, entityId, performedBy, startDate, endDate,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
		return
	}

	c.JSON(http.StatusOK, NewAuditLogListResponse(auditLogs, total, page, pageSize))
}

// GetAuditLogActions godoc
//
//	@Summary		Get audit log actions and entity types
//	@Description	Returns available actions and entity types for filtering audit logs
//	@Tags			audit-logs
//	@Produce		json
//	@Success		200	{object}	map[string]interface{}
//	@Router			/audit-logs/actions [get]
func (h *AuditLogHandler) GetAuditLogActions(c *gin.Context) {
	actions, err := h.repo.GetAuditLogActions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
		return
	}
	entityTypes, err := h.repo.GetAuditLogEntityTypes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"actions":      actions,
		"entity_types": entityTypes,
	})
}

// GetAuditLog godoc
// @Summary      Get audit log
// @Description  Returns details of an audit log entry
// @Tags         audit-logs
// @Produce      json
// @Param        id   path      int  true  "Audit Log ID"
// @Success      200  {object}  models.AuditLogResponse
// @Failure      404  {object}  models.ErrorResponse
// @Router       /audit-logs/{id} [get]
func (h *AuditLogHandler) GetAuditLog(c *gin.Context) {
	id := c.Param("id")
	log, err := h.repo.GetAuditLogByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: "Audit log not found"})
		return
	}
	c.JSON(http.StatusOK, NewAuditLogResponse(log))
}

func NewAuditLogResponse(log *models.AuditLog) models.AuditLogResponse {
	resp := models.AuditLogResponse{
		ID:         log.ID,
		Action:     log.Action,
		EntityType: log.EntityType,
		EntityID:   log.EntityID,
		Details:    log.Details,
		Timestamp:  log.Timestamp,
	}

	if log.PerformedByUser != nil {
		resp.PerformedBy = &models.UserShort{
			ID:       log.PerformedByUser.ID,
			Username: log.PerformedByUser.Username,
			FullName: log.PerformedByUser.FullName,
		}
	}
	return resp
}

func NewAuditLogListResponse(logs []models.AuditLog, total int64, page, pageSize int) models.AuditLogListResponse {
	logResponses := make([]models.AuditLogResponse, len(logs))
	for i, log := range logs {
		logResponses[i] = NewAuditLogResponse(&log)
	}
	return models.AuditLogListResponse{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		Logs:     logResponses,
	}
}
