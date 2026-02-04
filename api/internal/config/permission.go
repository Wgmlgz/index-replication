package config

type Permission struct {
	Obj string
	Act string
}

var (
	// User Permissions
	UsersView                = Permission{"users", "view"}
	UsersViewRoot            = Permission{"users", "view_root"}
	UsersCreate              = Permission{"users", "create"}
	UsersCreateAdministrator = Permission{"users", "create_role_administrator"}
	UsersCreateManager       = Permission{"users", "create_role_manager"}
	UsersCreateOperator      = Permission{"users", "create_role_operator"}
	UsersCreateObserver      = Permission{"users", "create_role_observer"}
	UsersDelete              = Permission{"users", "delete"}
	UsersDeleteAdministrator = Permission{"users", "delete_role_administrator"}
	UsersDeleteManager       = Permission{"users", "delete_role_manager"}
	UsersDeleteOperator      = Permission{"users", "delete_role_operator"}
	UsersDeleteObserver      = Permission{"users", "delete_role_observer"}
	UsersEdit                = Permission{"users", "edit"}
	UsersBlock               = Permission{"users", "block"}

	// Other Permissions
	AuditLogsView      = Permission{"audit_logs", "view"}
	SystemMetadataView = Permission{"system_metadata", "view"}
	SelfView           = Permission{"self", "view"}
	SelfUpdatePassword = Permission{"self", "update_password"}
)

var RolePermissions = map[string][]Permission{
	"administrator": {
		// Admin powers
		UsersCreateAdministrator,
		UsersBlock,
		UsersDelete,
		UsersDeleteAdministrator,
		AuditLogsView,
		// Manager powers
		UsersView,
		UsersCreate,
		UsersEdit,
		UsersCreateOperator,
		UsersCreateObserver,

		// Basic roles
		SystemMetadataView,
		SelfView,
		SelfUpdatePassword,
	},
	"manager": {
		// Manager powers
		UsersView,
		UsersCreate,
		UsersEdit,
		UsersCreateOperator,
		UsersCreateObserver,

		// Basic roles
		SystemMetadataView,
		SelfView,
		SelfUpdatePassword,
	},

	"operator": {
		// Basic roles
		SystemMetadataView,
		SelfView,
		SelfUpdatePassword,
	},

	"observer": {
		// Basic roles
		SystemMetadataView,
		SelfView,
		SelfUpdatePassword,
	},
}
