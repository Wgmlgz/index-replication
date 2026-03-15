# Keycloak Terraform

This Terraform root manages:

- PostgreSQL schema for Keycloak (`postgresql_schema`)
- Keycloak realm (`keycloak_realm`)
- Keycloak OIDC web client (`keycloak_openid_client`)
- Optional bootstrap user (`keycloak_user`)

Compose executes this root in two phases:

1. `keycloak-terraform-db` runs schema target apply.
2. `keycloak-terraform` runs full apply after Keycloak health is ready.

Most static values (DB host/port, Keycloak internal URL, web client defaults) are
defined in `variables.tf` defaults. Compose passes only values that typically vary
per environment (DB credentials, admin credentials, realm/schema names, optional bootstrap user).
