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
	return s.logActionWithSeverity(performedBy, action, models.SeverityInfo, entityType, entityID, details)
}

func (s *AuditService) LogDebugAction(performedBy int, action, entityType string, entityID *int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityDebug, entityType, entityID, details)
}

func (s *AuditService) LogWarningAction(performedBy int, action, entityType string, entityID *int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityWarning, entityType, entityID, details)
}

func (s *AuditService) LogErrorAction(performedBy int, action, entityType string, entityID *int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityError, entityType, entityID, details)
}

func (s *AuditService) LogCriticalAction(performedBy int, action, entityType string, entityID *int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityCritical, entityType, entityID, details)
}

func (s *AuditService) logActionWithSeverity(
	performedBy int,
	action string,
	severity string,
	entityType string,
	entityID *int,
	details interface{},
) error {
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
		Severity:    severity,
		EntityType:  entityType,
		EntityID:    entityID,
		Details:     detailsStr,
		Timestamp:   time.Now().UTC(),
	}
	// fmt.Println("new audit log:", auditLog)
	return s.db.Create(&auditLog).Error
}

// LogUserAction logs an action performed on a user
func (s *AuditService) LogUserAction(performedBy int, action string, userID int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityInfo, models.EntityTypeUser, &userID, details)
}

func (s *AuditService) LogUserDebugAction(performedBy int, action string, userID int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityDebug, models.EntityTypeUser, &userID, details)
}

func (s *AuditService) LogUserWarningAction(performedBy int, action string, userID int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityWarning, models.EntityTypeUser, &userID, details)
}

func (s *AuditService) LogUserErrorAction(performedBy int, action string, userID int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityError, models.EntityTypeUser, &userID, details)
}

func (s *AuditService) LogUserCriticalAction(performedBy int, action string, userID int, details interface{}) error {
	return s.logActionWithSeverity(performedBy, action, models.SeverityCritical, models.EntityTypeUser, &userID, details)
}
