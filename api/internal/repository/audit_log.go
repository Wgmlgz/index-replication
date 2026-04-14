package repository

import (
	"fmt"
	"server/internal/models"
	"strings"
	"time"

	"gorm.io/gorm"
)

type AuditLogRepository struct {
	db *gorm.DB
}

func NewAuditLogRepository(db *gorm.DB) *AuditLogRepository {
	return &AuditLogRepository{db: db}
}

func (r *AuditLogRepository) ListAuditLogs(
	page, pageSize int,
	search, action, entityType, entityId, performedBy string,
	start, end *time.Time,
	sortBy, sortDir string,
	viewerUserID *int,
) ([]models.AuditLog, int64, error) {
	dbQuery := r.db.Model(&models.AuditLog{}).
		Preload("PerformedByUser")
	dbQuery = scopeAuditLogsByViewer(dbQuery, viewerUserID)

	// Apply filters
	if search != "" {
		like := "%" + search + "%"
		dbQuery = dbQuery.Where(
			"CAST(id AS CHAR) LIKE ? OR action LIKE ? OR severity LIKE ? OR entity_type LIKE ? OR details LIKE ?",
			like, like, like, like, like,
		)
	}
	if action != "" {
		dbQuery = dbQuery.Where("action = ?", action)
	}
	if entityType != "" {
		dbQuery = dbQuery.Where("entity_type = ?", entityType)
	}
	if entityId != "" {
		dbQuery = dbQuery.Where("entity_id = ?", entityId)
	}
	if performedBy != "" {
		dbQuery = dbQuery.Where("performed_by = ?", performedBy)
	}
	if start != nil {
		dbQuery = dbQuery.Where("timestamp >= ?", *start)
	}
	if end != nil {
		dbQuery = dbQuery.Where("timestamp < ?", *end)
	}
	total := int64(0)
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	allowedSortColumns := map[string]string{
		"id":           "id",
		"action":       "action",
		"severity":     "severity",
		"entity_type":  "entity_type",
		"performed_by": "performed_by",
		"timestamp":    "timestamp",
	}
	sortColumn, ok := allowedSortColumns[sortBy]
	if !ok {
		sortColumn = "timestamp"
	}

	direction := "DESC"
	if strings.EqualFold(sortDir, "asc") {
		direction = "ASC"
	}

	if sortColumn == "timestamp" {
		// Keep stable ordering when logs share the same timestamp.
		dbQuery = dbQuery.Order(fmt.Sprintf("timestamp %s, id %s", direction, direction))
	} else {
		dbQuery = dbQuery.Order(fmt.Sprintf("%s %s, id DESC", sortColumn, direction))
	}
	dbQuery = dbQuery.Offset((page - 1) * pageSize).Limit(pageSize)

	var auditLogs []models.AuditLog
	if err := dbQuery.Find(&auditLogs).Error; err != nil {
		return nil, 0, err
	}

	return auditLogs, total, nil
}

func (r *AuditLogRepository) GetAuditLogByID(id string, viewerUserID *int) (*models.AuditLog, error) {
	var log models.AuditLog
	dbQuery := r.db.Preload("PerformedByUser")
	dbQuery = scopeAuditLogsByViewer(dbQuery, viewerUserID)
	if err := dbQuery.First(&log, id).Error; err != nil {
		return nil, err
	}
	return &log, nil
}

func (r *AuditLogRepository) GetAuditLogActions(viewerUserID *int) ([]string, error) {
	var actions []string
	dbQuery := r.db.Model(&models.AuditLog{})
	dbQuery = scopeAuditLogsByViewer(dbQuery, viewerUserID)
	err := dbQuery.Distinct().Pluck("action", &actions).Error
	return actions, err
}

func (r *AuditLogRepository) GetAuditLogEntityTypes(viewerUserID *int) ([]string, error) {
	var entityTypes []string
	dbQuery := r.db.Model(&models.AuditLog{})
	dbQuery = scopeAuditLogsByViewer(dbQuery, viewerUserID)
	err := dbQuery.Distinct().Pluck("entity_type", &entityTypes).Error
	return entityTypes, err
}

func scopeAuditLogsByViewer(dbQuery *gorm.DB, viewerUserID *int) *gorm.DB {
	if viewerUserID == nil {
		return dbQuery
	}
	return dbQuery.Where("performed_by = ?", *viewerUserID)
}
