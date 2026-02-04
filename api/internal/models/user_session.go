package models

import (
	"log"
	"time"

	gormsessions "github.com/gin-contrib/sessions/gorm"
	"gorm.io/gorm"
)

type UserSession struct {
	UserID    int    `gorm:"primaryKey;index"`
	SessionID string `gorm:"primaryKey;index"`
}

// Create a UserSession record
func CreateUserSession(db *gorm.DB, userID int, sessionID string) error {
	us := UserSession{UserID: userID, SessionID: sessionID}
	return db.Create(&us).Error
}

// Delete a UserSession record by session ID
func DeleteUserSession(db *gorm.DB, sessionID string) error {
	return db.Where("session_id = ?", sessionID).Delete(&UserSession{}).Error
}

// Delete all sessions for a user (used when blocking a user)
func DeleteAllSessionsForUser(db *gorm.DB, userID int) error {
	var sessions []UserSession

	if err := db.Where("user_id = ?", userID).Find(&sessions).Error; err != nil {
		return err
	}
	for _, us := range sessions {
		log.Printf("Deleting session with ID: %s", us.SessionID)
		db.Exec("DELETE FROM sessions WHERE id = ?", us.SessionID)
	}
	return db.Where("user_id = ?", userID).Delete(&UserSession{}).Error
}

// Periodically clean up UserSession records for sessions that no longer exist in the session store
func StartUserSessionCleanup(db *gorm.DB, store *gormsessions.Store, interval time.Duration, stopCh <-chan struct{}) {
	// go func() {
	// 	ticker := time.NewTicker(interval)
	// 	defer ticker.Stop()
	// 	for {
	// 		select {
	// 		case <-ticker.C:
	// 			var userSessions []UserSession
	// 			if err := db.Find(&userSessions).Error; err == nil {
	// 				for _, us := range userSessions {
	// 					if _, err := store.Get(us.SessionID); err != nil {
	// 						// Session does not exist, clean up
	// 						_ = db.Delete(&us).Error
	// 					}
	// 				}
	// 			}
	// 		case <-stopCh:
	// 			return
	// 		}
	// 	}
	// }()
}
