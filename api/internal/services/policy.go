package services

import (
	"log"
	"server/internal/config"
	"server/internal/models"

	"github.com/casbin/casbin/v2"
	gormadapter "github.com/casbin/gorm-adapter/v3"
	"gorm.io/gorm"
)

type CasbinService struct {
	enforcer *casbin.Enforcer
	db       *gorm.DB
}

func NewCasbinService(db *gorm.DB) *CasbinService {
	adapter, err := gormadapter.NewAdapterByDBWithCustomTable(db, &models.CasbinRule{}, "casbin_rules")
	if err != nil {
		log.Fatalf("Casbin adapter error: %v", err)
	}

	enforcer, err := casbin.NewEnforcer("internal/config/model.conf", adapter)
	if err != nil {
		log.Fatalf("Casbin enforcer error: %v", err)
	}

	err = enforcer.LoadPolicy()
	if err != nil {
		log.Fatalf("Load policy error: %v", err)
	}

	return &CasbinService{enforcer: enforcer, db: db}
}

func (c *CasbinService) CheckPermission(
	role string,
	permission config.Permission,
) bool {
	// log.Printf("Checking permission for role: `%s`, resource: %s, action: %s", role, permission.Obj, permission.Act)
	if role == "root" {
		// log.Println("can")
		return true
	}
	ok, _ := c.enforcer.Enforce(role, permission.Obj, permission.Act)
	log.Println("can= ", ok)
	return ok
}

func (c *CasbinService) GetPermissionsForRole(role string) [][]string {
	permissions, err := c.enforcer.GetPermissionsForUser(role)
	if err != nil {
		log.Printf("Error getting permissions for role %s: %v", role, err)
		return [][]string{}
	}
	return permissions
}

func (c *CasbinService) InitializePolicies() {
	for role, permissions := range config.RolePermissions {
		for _, perm := range permissions {
			c.enforcer.AddPolicy(role, perm.Obj, perm.Act)
		}
	}

	c.enforcer.SavePolicy()
}
