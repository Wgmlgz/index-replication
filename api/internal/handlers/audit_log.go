package handlers

import (
	"fmt"
	"net/http"
	"server/internal/api/dto"
	"server/internal/config"
	"server/internal/repository"
	"server/internal/services"
	"strings"
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
//	@Param			start_date		query		string	false	"Start date (RFC3339 or YYYY-MM-DD)"
//	@Param			end_date		query		string	false	"End date (RFC3339 or YYYY-MM-DD)"
//	@Param			sort_by			query		string	false	"Sort field (id, action, severity, entity_type, performed_by, timestamp)"
//	@Param			sort_dir		query		string	false	"Sort direction (asc, desc)"
//	@Success		200				{object}	dto.AuditLogListResponse
//	@Failure		500				{object}	dto.ErrorResponse
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
	sortBy := strings.TrimSpace(c.DefaultQuery("sort_by", "timestamp"))
	sortDir := strings.TrimSpace(c.DefaultQuery("sort_dir", "desc"))

	startDate := parseAuditFilterDate(c.Query("start_date"), false)
	endDate := parseAuditFilterDate(c.Query("end_date"), true)

	auditLogs, total, err := h.repo.ListAuditLogs(
		page, pageSize, search, action, entityType, entityId, performedBy, startDate, endDate, sortBy, sortDir,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
		return
	}

	c.JSON(http.StatusOK, dto.NewAuditLogListResponse(auditLogs, total, page, pageSize))
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
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
		return
	}
	entityTypes, err := h.repo.GetAuditLogEntityTypes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
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
// @Success      200  {object}  dto.AuditLogResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Router       /audit-logs/{id} [get]
func (h *AuditLogHandler) GetAuditLog(c *gin.Context) {
	id := c.Param("id")
	log, err := h.repo.GetAuditLogByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "Audit log not found"})
		return
	}
	c.JSON(http.StatusOK, dto.NewAuditLogResponse(log))
}

func parseAuditFilterDate(value string, dateOnlyEndExclusive bool) *time.Time {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	if parsed, err := time.Parse(time.RFC3339, trimmed); err == nil {
		return &parsed
	}

	if parsedDate, err := time.ParseInLocation("2006-01-02", trimmed, time.UTC); err == nil {
		if dateOnlyEndExclusive {
			parsedDate = parsedDate.AddDate(0, 0, 1)
		}
		return &parsedDate
	}

	return nil
}
