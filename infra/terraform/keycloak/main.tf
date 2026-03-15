terraform {
  required_version = ">= 1.6.0"

  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = ">= 1.23.0, < 2.0.0"
    }
    keycloak = {
      source  = "keycloak/keycloak"
      version = ">= 5.0.0, < 6.0.0"
    }
  }
}

provider "postgresql" {
  host     = var.postgres_host
  port     = var.postgres_port
  database = var.postgres_db
  username = var.postgres_user
  password = var.postgres_password
  sslmode  = var.postgres_sslmode
}

provider "keycloak" {
  client_id      = "admin-cli"
  username       = var.keycloak_admin_user
  password       = var.keycloak_admin_password
  url            = var.keycloak_url
  realm          = "master"
  initial_login  = false
  client_timeout = 30
}

locals {
  bootstrap_user_enabled = trimspace(var.keycloak_bootstrap_user) != ""
}

resource "postgresql_schema" "keycloak" {
  name          = var.keycloak_db_schema
  if_not_exists = true
}

resource "keycloak_realm" "app" {
  realm        = var.keycloak_realm
  enabled      = true
  display_name = var.keycloak_realm_display_name
}

resource "keycloak_openid_client" "web" {
  realm_id                     = keycloak_realm.app.id
  client_id                    = var.keycloak_web_client_id
  name                         = "Index Replication Web"
  enabled                      = true
  access_type                  = var.keycloak_web_public_client ? "PUBLIC" : "CONFIDENTIAL"
  standard_flow_enabled        = true
  implicit_flow_enabled        = false
  direct_access_grants_enabled = false
  service_accounts_enabled     = false
  valid_redirect_uris          = var.keycloak_web_redirect_uris
  valid_post_logout_redirect_uris = ["+"]
  web_origins                  = var.keycloak_web_origins
  pkce_code_challenge_method   = "S256"
}

resource "keycloak_user" "bootstrap" {
  count          = local.bootstrap_user_enabled ? 1 : 0
  realm_id       = keycloak_realm.app.id
  username       = var.keycloak_bootstrap_user
  enabled        = true
  email          = trimspace(var.keycloak_bootstrap_user_email) != "" ? var.keycloak_bootstrap_user_email : null
  email_verified = trimspace(var.keycloak_bootstrap_user_email) != ""

  initial_password {
    value     = var.keycloak_bootstrap_user_password
    temporary = false
  }

  lifecycle {
    precondition {
      condition     = trimspace(var.keycloak_bootstrap_user_password) != ""
      error_message = "KEYCLOAK_BOOTSTRAP_USER_PASSWORD is required when KEYCLOAK_BOOTSTRAP_USER is set."
    }
  }
}
