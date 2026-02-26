package dto

import (
	"time"

	"server/internal/models"
)

type AuditLogResponse struct {
	ID          int        `json:"id" binding:"required"`
	Action      string     `json:"action" binding:"required"`
	EntityType  string     `json:"entity_type" binding:"required"`
	EntityID    *int       `json:"entity_id"`
	Details     string     `json:"details"`
	LogImage    *string    `json:"log_image"`
	Timestamp   time.Time  `json:"timestamp" binding:"required"`
	PerformedBy *UserShort `json:"performed_by,omitempty"`
} //@name AuditLogResponse

type AuditLogListResponse struct {
	Total    int64              `json:"total" binding:"required"`
	Page     int                `json:"page" binding:"required"`
	PageSize int                `json:"page_size" binding:"required"`
	Logs     []AuditLogResponse `json:"logs" binding:"required"`
} //@name AuditLogListResponse

type UserShort struct {
	ID       int    `json:"id" binding:"required"`
	Username string `json:"username" binding:"required"`
	FullName string `json:"full_name" binding:"required"`
} //@name UserShort

func NewAuditLogResponse(log *models.AuditLog) AuditLogResponse {
	resp := AuditLogResponse{
		ID:         log.ID,
		Action:     log.Action,
		EntityType: log.EntityType,
		EntityID:   log.EntityID,
		Details:    log.Details,
		Timestamp:  log.Timestamp,
	}

	if log.PerformedByUser != nil {
		resp.PerformedBy = &UserShort{
			ID:       log.PerformedByUser.ID,
			Username: log.PerformedByUser.Username,
			FullName: log.PerformedByUser.FullName,
		}
	}

	return resp
}

func NewAuditLogListResponse(logs []models.AuditLog, total int64, page, pageSize int) AuditLogListResponse {
	logResponses := make([]AuditLogResponse, len(logs))
	for i, log := range logs {
		logResponses[i] = NewAuditLogResponse(&log)
	}

	return AuditLogListResponse{
		Total:    total,
		Page:     page,
		PageSize: pageSize,
		Logs:     logResponses,
	}
}
