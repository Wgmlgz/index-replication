terraform {
  required_version = ">= 1.6.0"

  required_providers {
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "= 1.26.0"
    }
    keycloak = {
      source  = "keycloak/keycloak"
      version = "= 5.3.0"
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
  bootstrap_user_enabled    = trimspace(var.keycloak_bootstrap_user) != ""
  google_idp_enabled        = trimspace(var.keycloak_google_client_id) != ""
  web_redirect_uris         = [for uri in split(",", var.keycloak_web_redirect_uris) : trimspace(uri) if trimspace(uri) != ""]
  web_origins               = [for origin in split(",", var.keycloak_web_origins) : trimspace(origin) if trimspace(origin) != ""]
  admin_proxy_redirect_uris = [for uri in split(",", var.keycloak_admin_proxy_redirect_uris) : trimspace(uri) if trimspace(uri) != ""]
}

resource "postgresql_schema" "keycloak" {
  name          = var.keycloak_db_schema
  if_not_exists = true
}

resource "keycloak_realm" "app" {
  realm        = var.keycloak_realm
  enabled      = true
  display_name = var.keycloak_realm_display_name
  login_theme  = var.keycloak_login_theme
  ssl_required = lower(trimspace(var.keycloak_ssl_required))
}

resource "keycloak_realm" "admin" {
  realm        = var.keycloak_admin_realm
  enabled      = true
  display_name = var.keycloak_admin_realm_display_name
  login_theme  = var.keycloak_login_theme
  ssl_required = lower(trimspace(var.keycloak_ssl_required))
}

resource "keycloak_realm_user_profile" "app" {
  realm_id = keycloak_realm.app.id

  group {
    name                = "user-metadata"
    display_header      = "User metadata"
    display_description = "Attributes, which refer to user metadata"
  }

  attribute {
    name         = "username"
    display_name = "$${username}"
    group        = "user-metadata"

    permissions {
      view = ["admin", "user"]
      edit = ["admin", "user"]
    }

    validator {
      name = "username-prohibited-characters"
    }

    validator {
      name = "up-username-not-idn-homograph"
    }

    validator {
      name = "length"
      config = {
        min = "3"
        max = "255"
      }
    }
  }

  attribute {
    name         = "email"
    display_name = "$${email}"
    group        = "user-metadata"

    permissions {
      view = ["admin"]
      edit = ["admin"]
    }

    validator {
      name = "email"
    }

    validator {
      name = "length"
      config = {
        max = "255"
      }
    }
  }

  attribute {
    name         = "firstName"
    display_name = "$${firstName}"
    group        = "user-metadata"

    permissions {
      view = ["admin"]
      edit = ["admin"]
    }

    validator {
      name = "person-name-prohibited-characters"
    }

    validator {
      name = "length"
      config = {
        max = "255"
      }
    }
  }

  attribute {
    name         = "lastName"
    display_name = "$${lastName}"
    group        = "user-metadata"

    permissions {
      view = ["admin"]
      edit = ["admin"]
    }

    validator {
      name = "person-name-prohibited-characters"
    }

    validator {
      name = "length"
      config = {
        max = "255"
      }
    }
  }
}

resource "keycloak_openid_client" "web" {
  realm_id                        = keycloak_realm.app.id
  client_id                       = var.keycloak_web_client_id
  name                            = "Index Replication Web"
  enabled                         = true
  access_type                     = var.keycloak_web_public_client ? "PUBLIC" : "CONFIDENTIAL"
  standard_flow_enabled           = true
  implicit_flow_enabled           = false
  direct_access_grants_enabled    = false
  service_accounts_enabled        = false
  valid_redirect_uris             = local.web_redirect_uris
  valid_post_logout_redirect_uris = ["+"]
  web_origins                     = local.web_origins
  pkce_code_challenge_method      = "S256"
}

resource "keycloak_openid_client" "admin_proxy" {
  realm_id                        = keycloak_realm.admin.id
  client_id                       = var.keycloak_admin_proxy_client_id
  name                            = "Index Replication Admin Proxy"
  enabled                         = true
  access_type                     = "CONFIDENTIAL"
  standard_flow_enabled           = true
  implicit_flow_enabled           = false
  direct_access_grants_enabled    = false
  service_accounts_enabled        = false
  valid_redirect_uris             = local.admin_proxy_redirect_uris
  valid_post_logout_redirect_uris = ["+"]
  web_origins                     = ["+"]
  client_secret                   = var.keycloak_admin_proxy_client_secret
}

resource "keycloak_oidc_google_identity_provider" "google" {
  count = local.google_idp_enabled ? 1 : 0

  realm         = keycloak_realm.app.id
  alias         = "google"
  display_name  = "Google"
  enabled       = true
  client_id     = var.keycloak_google_client_id
  client_secret = var.keycloak_google_client_secret

  default_scopes        = "openid profile email"
  trust_email           = var.keycloak_google_trust_email
  sync_mode             = var.keycloak_google_sync_mode
  hide_on_login_page    = var.keycloak_google_hide_on_login_page
  request_refresh_token = true

  lifecycle {
    precondition {
      condition     = trimspace(var.keycloak_google_client_secret) != ""
      error_message = "KEYCLOAK_GOOGLE_CLIENT_SECRET is required when KEYCLOAK_GOOGLE_CLIENT_ID is set."
    }
  }
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

resource "keycloak_user" "admin_bootstrap" {
  count          = local.bootstrap_user_enabled ? 1 : 0
  realm_id       = keycloak_realm.admin.id
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
