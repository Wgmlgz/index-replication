# Keycloak Terraform

This Terraform root manages:

- PostgreSQL schema for Keycloak (`postgresql_schema`)
- Keycloak realm (`keycloak_realm`)
- Keycloak realm user profile (`keycloak_realm_user_profile`) with only username editable for end users
- Keycloak OIDC web client (`keycloak_openid_client`)
- Optional bootstrap user (`keycloak_user`)

Compose executes this root in two phases:

1. `keycloak-terraform-db` runs schema target apply.
2. `keycloak-terraform` runs full apply after Keycloak health is ready.

Compose builds a Terraform image from this directory, so `.tf` files are available in
remote environments (for example, Koolify) without host bind mounts.
Terraform local state is stored in compose named volume `keycloak_terraform_state`.

Most static values (DB host/port, Keycloak internal URL, web client defaults) are
defined in `variables.tf` defaults. Compose passes only values that typically vary
per environment (DB credentials, admin credentials, realm/schema names, optional bootstrap user).
