package services

import (
	"encoding/json"
	"server/internal/models"
	"time"

	"gorm.io/gorm"
)

type AuditService struct {
	db *gorm.DB
}

func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{db: db}
}

// LogAction logs an action to the audit log
func (s *AuditService) LogAction(performedBy int, action, entityType string, entityID *int, details interface{}) error {
	// Convert details to JSON string
	var detailsStr string
	if details != nil {
		if jsonBytes, err := json.Marshal(details); err == nil {
			detailsStr = string(jsonBytes)
		}
	}

	auditLog := models.AuditLog{
		PerformedBy: performedBy,
		Action:      action,
		EntityType:  entityType,
		EntityID:    entityID,
		Details:     detailsStr,
		Timestamp:   time.Now(),
	}
	// fmt.Println("new audit log:", auditLog)
	return s.db.Create(&auditLog).Error
}

// LogUserAction logs an action performed on a user
func (s *AuditService) LogUserAction(performedBy int, action string, userID int, details interface{}) error {
	return s.LogAction(performedBy, action, models.EntityTypeUser, &userID, details)
}
