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
	MoexView           = Permission{"moex", "view"}
	SelfView           = Permission{"self", "view"}
	SelfUpdateSettings = Permission{"self", "update_settings"}
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
		AuditLogsView,
		SystemMetadataView,
		MoexView,
		SelfView,
		SelfUpdateSettings,
	},
	"manager": {
		// Manager powers
		UsersView,
		UsersCreate,
		UsersEdit,
		UsersCreateOperator,
		UsersCreateObserver,

		// Basic roles
		AuditLogsView,
		SystemMetadataView,
		MoexView,
		SelfView,
		SelfUpdateSettings,
	},

	"operator": {
		// Basic roles
		AuditLogsView,
		SystemMetadataView,
		MoexView,
		SelfView,
		SelfUpdateSettings,
	},

	"observer": {
		// Basic roles
		AuditLogsView,
		SystemMetadataView,
		MoexView,
		SelfView,
		SelfUpdateSettings,
	},
}
