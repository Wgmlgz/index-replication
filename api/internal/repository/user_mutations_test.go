package repository

import (
	"context"
	"errors"
	"strconv"
	"testing"

	"server/internal/models"
	"server/internal/testutil"

	"gorm.io/gorm"
)

func TestCreateUser(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	repo := NewUserRepository(db)

	req := models.CreateUserRequest{
		Username: "alice",
		Password: "password123",
		FullName: "Alice Example",
		RoleID:   2,
		Comment:  "test user",
	}

	user, err := repo.CreateUser(req)
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	if user.ID == 0 {
		t.Fatalf("expected user ID to be set")
	}
	if user.PasswordHash == req.Password {
		t.Fatalf("expected password hash to be stored instead of plaintext")
	}

	fetched, err := repo.GetUserByUsername(req.Username)
	if err != nil {
		t.Fatalf("failed to fetch user: %v", err)
	}
	if fetched.ID != user.ID {
		t.Fatalf("expected user ID %d, got %d", user.ID, fetched.ID)
	}
}

func TestDeleteUser(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	repo := NewUserRepository(db)

	user, err := repo.CreateUser(models.CreateUserRequest{
		Username: "bob",
		Password: "password123",
		FullName: "Bob Example",
		RoleID:   2,
	})
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	if err := repo.DeleteUser(context.Background(), strconv.Itoa(user.ID)); err != nil {
		t.Fatalf("failed to delete user: %v", err)
	}

	_, err = repo.GetUserByID(strconv.Itoa(user.ID))
	if err == nil {
		t.Fatalf("expected error when fetching deleted user")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}
}
