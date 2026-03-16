# Keycloak Terraform

This Terraform root manages:

- PostgreSQL schema for Keycloak (`postgresql_schema`)
- Keycloak app realm (`keycloak_realm.app`)
- Keycloak admin-tools realm (`keycloak_realm.admin`)
- Keycloak realm login themes (`keycloak_realm.app.login_theme`, `keycloak_realm.admin.login_theme`)
- Keycloak realm user profile (`keycloak_realm_user_profile`) with only username editable for end users
- Keycloak OIDC web client (`keycloak_openid_client`)
- Keycloak OIDC confidential client for admin proxy (`keycloak_openid_client.admin_proxy`)
- Optional bootstrap user in both app/admin realms (`keycloak_user.bootstrap`, `keycloak_user.admin_bootstrap`)

Compose executes this root in two phases:

1. `keycloak-terraform-db` runs schema target apply.
2. `keycloak-terraform` runs full apply after Keycloak health is ready.

Compose builds a Terraform image from this directory, so `.tf` files are available in
remote environments (for example, Koolify) without host bind mounts.
Provider binaries (`cyrilgdn/postgresql`, `keycloak/keycloak`) are downloaded at image build time
into `/opt/terraform/providers`, and compose sets `TF_CLI_ARGS_init=-plugin-dir=/opt/terraform/providers`
so runtime `terraform init` does not need `registry.terraform.io`.
Terraform local state is stored in compose named volume `keycloak_terraform_state`.

Most static values (DB host/port, Keycloak internal URL including relative path `/auth`, web client defaults) are
defined in `variables.tf` defaults. Compose passes only values that typically vary
per environment (DB credentials, admin credentials, realm/schema names, optional bootstrap user).

`keycloak_login_theme` default is `index-replication` and is typically driven from compose env
(`TF_VAR_keycloak_login_theme` mapped from `KEYCLOAK_THEME_NAME`).
