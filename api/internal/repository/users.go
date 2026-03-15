package repository

import (
	"context"
	"errors"
	"fmt"
	"server/internal/models"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

type CreateUserInput struct {
	Username string
	Password string
	FullName string
	RoleID   int
	Comment  string
}

type UpdateUserInput struct {
	FullName string
	Phone    string
	Email    string
	Password *string
	RoleID   int
	Comment  string
}

type EnsureKeycloakUserInput struct {
	Sub               string
	PreferredUsername string
	Email             string
	FullName          string
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) ListUsers(page, pageSize int, search string, sortBy, sortDir string, viewRoot bool) ([]models.User, int64, error) {
	dbQuery := r.db.Model(&models.User{})
	if search != "" {
		like := "%" + search + "%"
		dbQuery = dbQuery.Where(
			"CAST(id AS CHAR) LIKE ? OR username LIKE ? OR keycloak_sub LIKE ? OR full_name LIKE ? OR CAST(role_id AS CHAR) LIKE ? OR phone LIKE ? OR email LIKE ? OR CAST(last_active AS CHAR) LIKE ? OR CAST(blocked_at AS CHAR) LIKE ? OR CAST(created_at AS CHAR) LIKE ?",
			like, like, like, like, like, like, like, like, like, like,
		)
	}

	if !viewRoot {
		dbQuery.Where("username != 'root'")
	}

	total := int64(0)
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	dbQuery = dbQuery.Order(sortBy + " " + sortDir)
	dbQuery = dbQuery.Offset((page - 1) * pageSize).Limit(pageSize)

	var users []models.User
	if err := dbQuery.Preload("Role").Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (r *UserRepository) CreateUser(input CreateUserInput) (*models.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := models.User{
		Username:     input.Username,
		PasswordHash: string(hash),
		FullName:     input.FullName,
		RoleID:       input.RoleID,
		Comment:      input.Comment,
	}

	if err := r.db.Create(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetUserByID(id string) (*models.User, error) {
	var user models.User
	if err := r.db.Preload("Role").First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetRoleKeyByID(id int) (string, error) {
	var role models.Role
	if err := r.db.First(&role, id).Error; err != nil {
		return "", err
	}
	return role.Key, nil
}

func (r *UserRepository) UpdateUser(id string, input UpdateUserInput) (*models.User, string, *models.User, *models.User, error) {
	var user models.User
	if err := r.db.First(&user, id).Error; err != nil {
		return nil, "", nil, nil, err
	}

	oldUser := user

	// Role changed
	if user.RoleID != input.RoleID {
		// Logout
		_ = models.DeleteAllSessionsForUser(r.db, user.ID)
	}

	action := models.ActionUserUpdated

	user.FullName = input.FullName
	user.RoleID = input.RoleID
	user.Phone = input.Phone
	user.Email = input.Email
	user.Comment = input.Comment

	if input.Password != nil {
		hash, err := bcrypt.GenerateFromPassword([]byte(*input.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, "", nil, nil, fmt.Errorf("failed to hash password: %w", err)
		}
		user.PasswordHash = string(hash)
		action = models.ActionPasswordReset
	}

	if err := r.db.Save(&user).Error; err != nil {
		return nil, "", nil, nil, err
	}

	newUser := user

	return &user, action, &oldUser, &newUser, nil
}

func (r *UserRepository) GetCurrentUser(userID interface{}) (*models.User, error) {
	var user models.User
	if err := r.db.Preload("Role").First(&user, userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) BlockUser(id string) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	if user.BlockedAt == nil {
		now := time.Now()
		user.BlockedAt = &now
		if err := r.db.Save(&user).Error; err != nil {
			return nil, err
		}
		_ = models.DeleteAllSessionsForUser(r.db, user.ID)
	}
	return &user, nil
}

func (r *UserRepository) UnblockUser(id string) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	if user.BlockedAt != nil {
		user.BlockedAt = nil
		if err := r.db.Save(&user).Error; err != nil {
			return nil, err
		}
	}
	return &user, nil
}

func (r *UserRepository) GetUserByUsername(username string) (*models.User, error) {
	var user models.User
	result := r.db.Where("username = ?", username).Preload("Role").First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (r *UserRepository) GetUserByKeycloakSub(sub string) (*models.User, error) {
	var user models.User
	result := r.db.Where("keycloak_sub = ?", strings.TrimSpace(sub)).Preload("Role").First(&user)
	if result.Error != nil {
		return nil, result.Error
	}
	return &user, nil
}

func (r *UserRepository) EnsureUserByKeycloakSub(input EnsureKeycloakUserInput) (*models.User, bool, error) {
	sub := strings.TrimSpace(input.Sub)
	if sub == "" {
		return nil, false, fmt.Errorf("keycloak sub is required")
	}

	if existing, err := r.GetUserByKeycloakSub(sub); err == nil {
		return existing, false, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, err
	}

	roleID, err := r.getRoleIDByKey("observer")
	if err != nil {
		return nil, false, err
	}

	baseUsername := normalizeKeycloakUsername(input.PreferredUsername)
	if baseUsername == "" {
		baseUsername = "kc_" + normalizeKeycloakUsername(sub)
	}
	if baseUsername == "" {
		baseUsername = "kc_user"
	}

	fullName := strings.TrimSpace(input.FullName)
	if fullName == "" {
		fullName = baseUsername
	}
	if len(fullName) > 255 {
		fullName = fullName[:255]
	}

	email := strings.TrimSpace(input.Email)
	if len(email) > 255 {
		email = email[:255]
	}

	randomPasswordHash, err := bcrypt.GenerateFromPassword([]byte(uuid.NewString()), bcrypt.DefaultCost)
	if err != nil {
		return nil, false, fmt.Errorf("failed to generate password hash: %w", err)
	}

	subCopy := sub
	for attempt := 0; attempt < 100; attempt++ {
		username := makeKeycloakUsernameCandidate(baseUsername, attempt)
		if username == "" {
			username = fmt.Sprintf("kc_user_%d", attempt+1)
		}

		user := models.User{
			Username:     username,
			PasswordHash: string(randomPasswordHash),
			KeycloakSub:  &subCopy,
			FullName:     fullName,
			RoleID:       roleID,
			Email:        email,
			Comment:      "Auto-created from Keycloak login",
		}

		if err := r.db.Create(&user).Error; err == nil {
			var created models.User
			if err := r.db.Preload("Role").First(&created, user.ID).Error; err != nil {
				return nil, false, err
			}
			return &created, true, nil
		} else {
			if existing, getErr := r.GetUserByKeycloakSub(sub); getErr == nil {
				return existing, false, nil
			} else if !errors.Is(getErr, gorm.ErrRecordNotFound) {
				return nil, false, getErr
			}

			errText := strings.ToLower(err.Error())
			if strings.Contains(errText, "unique") || strings.Contains(errText, "duplicate") {
				continue
			}
			return nil, false, err
		}
	}

	return nil, false, fmt.Errorf("failed to allocate unique username for keycloak user")
}

func (r *UserRepository) UpdateLastActive(user *models.User) error {
	now := time.Now()
	return r.db.Model(user).Update("last_active", &now).Error
}

func (r *UserRepository) UpdatePassword(userID interface{}, newPassword string) error {
	var user models.User
	if err := r.db.Select("password_hash").Where("id = ?", userID).First(&user).Error; err != nil {
		return err
	}

	// Verify old password (if needed, though not in the original logic)

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	return r.db.Model(&models.User{}).Where("id = ?", userID).Update("password_hash", string(newHash)).Error
}

func (r *UserRepository) DeleteUser(ctx context.Context, id string) error {
	return r.db.Delete(&models.User{}, "id = ?", id).Error
}

func (r *UserRepository) getRoleIDByKey(roleKey string) (int, error) {
	var role models.Role
	if err := r.db.Where("key = ?", roleKey).First(&role).Error; err != nil {
		return 0, err
	}
	return role.ID, nil
}

func normalizeKeycloakUsername(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return ""
	}

	var b strings.Builder
	b.Grow(len(value))
	for _, ch := range value {
		switch {
		case ch >= 'a' && ch <= 'z':
			b.WriteRune(ch)
		case ch >= '0' && ch <= '9':
			b.WriteRune(ch)
		case ch == '.', ch == '_', ch == '-':
			b.WriteRune(ch)
		default:
			b.WriteRune('_')
		}
	}

	out := strings.Trim(b.String(), "._-")
	if len(out) > 64 {
		out = out[:64]
	}
	return strings.Trim(out, "._-")
}

func makeKeycloakUsernameCandidate(base string, attempt int) string {
	if attempt == 0 {
		return base
	}
	suffix := fmt.Sprintf("_%d", attempt+1)
	maxBaseLen := 255 - len(suffix)
	if maxBaseLen < 1 {
		return ""
	}
	if len(base) > maxBaseLen {
		base = base[:maxBaseLen]
	}
	base = strings.Trim(base, "._-")
	if base == "" {
		return ""
	}
	return base + suffix
}
