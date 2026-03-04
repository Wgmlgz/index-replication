package repository

import (
	"testing"

	"server/internal/models"
	"server/internal/testutil"
)

func TestPortfolioProfilesRepository_DefaultHandling(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	repo := NewPortfolioProfilesRepository(db)

	p1 := &models.PortfolioProfile{
		UserID:     10,
		Provider:   "mock",
		Name:       "Mock A",
		IsDefault:  true,
		ConfigJSON: "{}",
		SecretJSON: "{}",
	}
	if err := repo.Create(p1); err != nil {
		t.Fatalf("create p1: %v", err)
	}

	p2 := &models.PortfolioProfile{
		UserID:     10,
		Provider:   "mock",
		Name:       "Mock B",
		IsDefault:  false,
		ConfigJSON: "{}",
		SecretJSON: "{}",
	}
	if err := repo.Create(p2); err != nil {
		t.Fatalf("create p2: %v", err)
	}

	if err := repo.SetDefault(10, p2.ID); err != nil {
		t.Fatalf("set default: %v", err)
	}

	rows, err := repo.ListByUser(10)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(rows))
	}
	if !rows[0].IsDefault || rows[0].ID != p2.ID {
		t.Fatalf("expected profile %d to be default first row", p2.ID)
	}

	loaded, err := repo.GetByID(10, p1.ID)
	if err != nil {
		t.Fatalf("get p1: %v", err)
	}
	if loaded.IsDefault {
		t.Fatalf("expected p1 not default")
	}

	deleted, err := repo.Delete(10, p1.ID)
	if err != nil {
		t.Fatalf("delete p1: %v", err)
	}
	if !deleted {
		t.Fatalf("expected delete result true")
	}

	deleted, err = repo.Delete(10, 9999)
	if err != nil {
		t.Fatalf("delete missing: %v", err)
	}
	if deleted {
		t.Fatalf("expected delete missing result false")
	}
}

func TestPortfolioProfilesRepository_EnsureSingleDefault(t *testing.T) {
	db, cleanup := testutil.NewTestDB(t)
	defer cleanup()

	repo := NewPortfolioProfilesRepository(db)
	for i := 0; i < 3; i++ {
		profile := &models.PortfolioProfile{
			UserID:     77,
			Provider:   "mock",
			Name:       "Profile",
			IsDefault:  false,
			ConfigJSON: "{}",
			SecretJSON: "{}",
		}
		if err := repo.Create(profile); err != nil {
			t.Fatalf("create profile %d: %v", i, err)
		}
	}

	if err := repo.EnsureSingleDefault(77); err != nil {
		t.Fatalf("ensure single default: %v", err)
	}

	rows, err := repo.ListByUser(77)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	defaultCount := 0
	for _, row := range rows {
		if row.IsDefault {
			defaultCount++
		}
	}
	if defaultCount != 1 {
		t.Fatalf("expected exactly one default, got %d", defaultCount)
	}
}
