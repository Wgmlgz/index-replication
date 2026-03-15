variable "postgres_host" {
  description = "PostgreSQL host."
  type        = string
  default     = "postgres"
}

variable "postgres_port" {
  description = "PostgreSQL port."
  type        = number
  default     = 5432
}

variable "postgres_db" {
  description = "PostgreSQL database."
  type        = string
}

variable "postgres_user" {
  description = "PostgreSQL username."
  type        = string
}

variable "postgres_password" {
  description = "PostgreSQL password."
  type        = string
  sensitive   = true
}

variable "postgres_sslmode" {
  description = "PostgreSQL SSL mode."
  type        = string
  default     = "disable"
}

variable "keycloak_db_schema" {
  description = "Schema to store Keycloak tables in."
  type        = string
  default     = "keycloak"
}

variable "keycloak_url" {
  description = "Keycloak base URL."
  type        = string
  default     = "http://keycloak:8080/auth"
}

variable "keycloak_admin_user" {
  description = "Keycloak admin username (master realm)."
  type        = string
}

variable "keycloak_admin_password" {
  description = "Keycloak admin password (master realm)."
  type        = string
  sensitive   = true
}

variable "keycloak_realm" {
  description = "Application realm name."
  type        = string
  default     = "index-replication"
}

variable "keycloak_realm_display_name" {
  description = "Application realm display name."
  type        = string
  default     = "Index Replication"
}

variable "keycloak_admin_realm" {
  description = "Admin-tools realm name used by oauth2-proxy."
  type        = string
  default     = "index-replication-admin"
}

variable "keycloak_admin_realm_display_name" {
  description = "Admin-tools realm display name."
  type        = string
  default     = "Index Replication Admin"
}

variable "keycloak_login_theme" {
  description = "Login theme name applied to the realm."
  type        = string
  default     = "index-replication"
}

variable "keycloak_web_client_id" {
  description = "OIDC client id for the web app."
  type        = string
  default     = "web"
}

variable "keycloak_web_public_client" {
  description = "Whether web client is public."
  type        = bool
  default     = true
}

variable "keycloak_web_redirect_uris" {
  description = "Valid redirect URIs for web OIDC client."
  type        = list(string)
  default = [
    "http://localhost:3000/login*",
    "http://localhost:30000/login*",
  ]
}

variable "keycloak_web_origins" {
  description = "Valid web origins for web OIDC client."
  type        = list(string)
  default = [
    "http://localhost:3000",
    "http://localhost:30000",
  ]
}

variable "keycloak_admin_proxy_client_id" {
  description = "OIDC client id for oauth2-proxy that protects Adminer/Temporal UI."
  type        = string
  default     = "admin-proxy"
}

variable "keycloak_admin_proxy_client_secret" {
  description = "OIDC client secret for oauth2-proxy Adminer/Temporal guard."
  type        = string
  default     = "change-me"
  sensitive   = true
}

variable "keycloak_admin_proxy_redirect_uris" {
  description = "Valid redirect URIs for oauth2-proxy callback."
  type        = list(string)
  default = [
    "http://localhost:30000/oauth2/callback",
    "http://app123.localhost:30000/oauth2/callback",
  ]
}

variable "keycloak_bootstrap_user" {
  description = "Optional bootstrap username. Leave empty to skip user creation."
  type        = string
  default     = ""
}

variable "keycloak_bootstrap_user_password" {
  description = "Password for optional bootstrap user."
  type        = string
  default     = ""
  sensitive   = true
}

variable "keycloak_bootstrap_user_email" {
  description = "Optional email for bootstrap user."
  type        = string
  default     = ""
}
