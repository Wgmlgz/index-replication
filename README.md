# Index Replication

This repo contains a Go REST API and a Next.js web app. New contributors should read these docs first:

- `README.md` (this file)
- `api/README.md` (backend)
- `web/README.md` (frontend)
- `docs/TELEGRAM-VERIFICATION.md` (Telegram two-step login setup and flow)

## Tech Overview

Backend:

- Go 1.23, Gin, GORM
- Postgres as primary DB
- Session-based auth (cookie) with `gin-contrib/sessions` + GORM store
- RBAC/permissions via Casbin
- Migrations via Goose
- OpenAPI/Swagger via swaggo (used to generate frontend API client)

Frontend:

- Next.js App Router (React 19)
- Tailwind CSS v4 + shadcn/ui (Radix UI + class-variance-authority)
- Axios for API calls (with Tauri adapter support)
- OIDC login option (`oidc-client-ts`) for Keycloak bearer auth mode
- Lightweight Charts for market data visualization
- React Hook Form + Zod (i18next-backed error messages)
- OpenAPI Generator `typescript-axios` client in `web/src/api-client`
- Portfolio UI (`/portfolio`) built on provider-agnostic portfolio profiles (`/api/me/portfolios/:id/*`)
  with providers: `tbank`, `mock`, `virtual`
  and optional per-profile replication config (benchmark/mode/exclusions) embedded in portfolio list/summary responses.

## Preferred Commands

The preferred way to run commands is through Taskfiles.

- Root: `task --list`
- API: `cd api && task --list`
- Web: `cd web && task --list`
- Web i18n maintenance: `task i18n:unused`, `task i18n:prune`, `task i18n:check`

Private admin access via Tailscale Serve:

- `task tailscale:admin:enable`
- `task tailscale:admin:status`
- `task tailscale:admin:disable`

Fixed mappings:
- Adminer: tailnet HTTPS `8443` -> `127.0.0.1:8081`
- Temporal UI: tailnet HTTPS `9443` -> `127.0.0.1:8233`

## Quick Start (Local)

1. Start infra and services:

```bash
task docker
```

2. Or run services individually with their Taskfiles:

```bash
cd api && task dev
cd web && task dev
```

Temporal stack can be started separately with:

```bash
task temporal:up
```
Temporal services are based on the official `samples-server` postgres compose pattern and reuse the existing `postgres` service.
Temporal admin-tools bootstrap scripts are baked into a custom image during compose build (instead of runtime bind mounts) to keep remote deployments consistent.
Temporal dynamic config (`scripts/temporal/dynamicconfig/docker.yaml`) is also baked into a custom Temporal server image for the same reason.
MOEX namespace/search-attributes/schedules are applied automatically on startup by the one-shot `temporal-setup` service (no manual schedule bootstrapping needed in Docker).
Operational timeline and monitoring details are documented in `docs/TEMPORAL-MOEX-OPERATIONS.md`.
Historical MOEX API reads are DB-backed; coverage status is exposed via response headers and sync admin endpoints.
Portfolio `virtual` and `tbank` mark-to-market valuation now uses on-demand MOEX share security history cache
(`moex_security_history_daily` + `moex_data_coverage` dataset `security_history`): cache miss triggers fetch+upsert,
cache hit serves from DB. If no MOEX quote exists for an anchor date, valuation falls back to provider legacy price.

## Keycloak Infra (Auto-Bootstrap)

Docker compose includes Keycloak with no manual UI setup:

- Single Terraform codebase in `infra/terraform/keycloak` is applied in two phases:
  - `keycloak-terraform-db` creates/ensures a dedicated Keycloak schema in existing Postgres.
  - `keycloak-terraform` applies Keycloak realm/client/user resources after Keycloak is healthy.
- Realm user profile is managed by Terraform so end-user profile fields (`email`, `firstName`, `lastName`) are not required or editable by users.
- Terraform config is baked into a tiny image built from `infra/terraform/keycloak` (no host bind mount required for remote deploys).
- Terraform local state is persisted in compose named volume `keycloak_terraform_state` so re-deploys stay idempotent.
- Keycloak is exposed by Traefik on the same app port under `${KEYCLOAK_HTTP_RELATIVE_PATH}` (default `/auth`).
- `keycloak` is also reachable directly on `127.0.0.1:${KEYCLOAK_PORT}` for local debugging.

DB reuse behavior:

- Keycloak reuses the existing `postgres` service and the same `${POSTGRES_DB}` database.
- Keycloak tables are isolated in `${KEYCLOAK_DB_SCHEMA}` (default `keycloak`).

Useful env vars are documented in `.env.example` (`KEYCLOAK_*`).
Compose now passes only changing/sensitive Terraform inputs; static values (like
`postgres` host and internal Keycloak URL) are defaulted in `infra/terraform/keycloak/variables.tf`.

Useful commands:

- `task keycloak:up` to start Keycloak and run Terraform bootstrap.
- `task keycloak:apply` to force re-apply Keycloak Terraform after env/config changes.

API integration:

- Backend protected routes can use Keycloak JWT bearer middleware (`Authorization: Bearer ...`).
- Local users are linked by `users.keycloak_sub` and auto-created on first Keycloak-authenticated request.

## Move Backfilled MOEX Data (Local -> Prod)

Use `scripts/moex-backfill-transfer.sh` to transfer only MOEX backfill tables (`moex_*`) between compose deployments.

Examples:

```bash
# 1) Export local data to a dump file
./scripts/moex-backfill-transfer.sh dump --file ./backups/moex-backfill.sql.gz

# 2) On prod context, restore that dump (truncates MOEX tables first)
./scripts/moex-backfill-transfer.sh restore --target-context prod --file ./backups/moex-backfill.sql.gz

# Or run both in one command
./scripts/moex-backfill-transfer.sh migrate --target-context prod
```

If a docker context has multiple compose projects, pass `--source-project` / `--target-project`.

## Repo Layout

- `api/` Go REST API
- `web/` Next.js frontend
- `Taskfile.yml` root-level tasks (currently Docker compose)
- `docker-compose.yml` local stack

## Docs Maintenance

If you change code or behavior in a way that makes any README inaccurate or incomplete, update the docs in the same change. The expectation is that docs stay correct and actionable for the next developer (human or AI).
See `docs/GUIDELINES.md` for documentation and code organization guidelines, including keeping files short.

## MOEX Docs Cache

To keep a local copy of the MOEX ISS reference pages, run:

```bash
task moex:docs
```

Cached docs are stored in `docs/moex/`.

If you are working on the MOEX client or related UI, read `docs/moex/ISS-CONCEPTS.md` first.

## API Client Generation (Backend -> Frontend)

The frontend API client is generated from the backend OpenAPI spec.

1. Generate the OpenAPI spec:

```bash
cd api
task api:gen
```

2. Regenerate the frontend client:

```bash
cd web
task api:gen
```

The spec is output to `api/docs/swagger.json`. The web generator script reads this file and handles both Docker (`/local/...`) and local path modes automatically.
