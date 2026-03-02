# API (Backend)

Go REST API with session-based auth, user management, and audit logging.

## Tech & Libraries

- Go 1.23
- Gin (`github.com/gin-gonic/gin`) for HTTP routing
- GORM for ORM and DB access
- Postgres as the primary database
- Sessions via `gin-contrib/sessions` + GORM session store
- RBAC permissions with Casbin (`internal/config/model.conf`, `internal/config/permission.go`)
- Migrations via Goose
- OpenAPI via swaggo annotations in handlers

## Preferred Commands

Use the Taskfile for all common operations:

```bash
cd api
task --list
```

Common tasks:

- `task dev`
- `task worker:dev`
- `task schedules:apply` (manual/local; Docker startup auto-applies schedules)
- `task lint`
- `task test`
- `task migrate:up`
- `task api:gen`

Note: `task dev` uses `go run github.com/air-verse/air@latest` for hot reloading.

## Architecture & Principles

- HTTP layer stays in `internal/handlers/` (request/response parsing, status codes).
- API request/response DTOs live in `internal/api/dto/` (feature-grouped schema structs for handlers/OpenAPI).
- Business logic lives in feature/service packages (mostly `internal/services/`, with MOEX isolated in `internal/moex/`, T-Bank isolated in `internal/tbank/`, and Telegram verification isolated in `internal/telegram/`).
- Provider-agnostic portfolio domain lives in `internal/portfolio/` (profile CRUD + provider registry/adapters).
- Data access is isolated in `internal/repository/` using GORM.
- Auth is session-based (cookie) and enforced by middleware.
- Authorization uses Casbin policies and permission constants.
- Audit logging is a first-class concern.

## Entry Points

- `main.go` boots the server and wires config, routes, and middleware.
- `internal/routes/` defines the HTTP routes.
- `internal/handlers/` contains request handlers (HTTP layer).
- `internal/api/dto/` contains HTTP DTOs and OpenAPI schema models.
- `internal/services/` contains most business logic.
- `internal/moex/` contains MOEX integration logic and read services.
- `internal/moex/domain/` contains MOEX internal/domain structs used by MOEX + repository layers.
- `internal/tbank/` contains T-Bank integration logic and gRPC client operations.
- `internal/portfolio/` contains unified portfolio orchestration and provider adapters (`tbank`, `mock`).
- `internal/telegram/` contains Telegram bot transport and login verification integration logic.
- `internal/repository/` contains data access (DB queries).
- `internal/models/` defines persistence/domain models (GORM entities and domain constants).

## Where To Implement Changes

Use this mapping to locate the right layer quickly:

- Add or change endpoints: `internal/routes/`, `internal/handlers/`
- Change business rules or workflows: `internal/services/` (or feature packages like `internal/moex/`, `internal/tbank/`, and `internal/telegram/`)
- Change DB queries or persistence: `internal/repository/`
- Update API request/response structures: `internal/api/dto/`
- Update persistence/domain structures: `internal/models/`
- Add middleware or request/response behavior: `internal/middleware/`
- Auth and session flow: `internal/handlers/auth.go`, `internal/middleware/session.go`
- User management endpoints: `internal/handlers/users.go`, `internal/repository/users.go`
- T-Bank integration/test trading: `internal/handlers/tbank.go`, `internal/tbank/`
- Unified portfolio API and providers: `internal/handlers/portfolio.go`, `internal/portfolio/`, `internal/repository/portfolio_profiles.go`
- Audit log endpoints and behavior: `internal/handlers/audit_log.go`, `internal/services/audit_service.go`
- Bot/token auth: `internal/middleware/token.go`
- Add or change permissions: `internal/config/permission.go`, `internal/config/model.conf`
- Session behavior (cookies, lifetime, storage): `internal/middleware/session.go`, `internal/models/user_session.go`
- Audit logging behavior: `internal/services/audit_service.go`, `internal/models/audit_log.go`
- Shared helpers: `internal/utils/`

## Database & Migrations

- SQL migrations live in `migrations/`.
- Run migrations with Taskfile commands.

```bash
cd api
task migrate:status
task migrate:up
```

## Configuration

Environment variables live in `.env`. Key settings:

- `DATABASE_URL` (preferred)
- `RUN_MIGRATIONS` (default `true`)
- `MIGRATIONS_DIR` (optional override)
- `MOEX_BASE_URL` (default `https://iss.amogos.pro/iss`)
- `TELEGRAM_BOT_TOKEN` (optional; enables Telegram login verification transport)
- `TELEGRAM_BOT_USERNAME` (optional; used to build Telegram connect links)
- `TELEGRAM_POLL_TIMEOUT_SEC` (default `30`, Telegram long-poll timeout)
- `LOGIN_VERIFICATION_TTL_SECONDS` (default `300`, login challenge expiration)
- `MOEX_MUTABLE_DAYS` (default `30`)
- `MOEX_IMMUTABLE_BEFORE_DATE` (optional `YYYY-MM-DD`, immutable boundary)
- `MOEX_LIVE_CURRENT_DAY_ENABLED` (default `false`, optional current-day live overlay)
- `MOEX_ENABLE_MONTHLY_DEEP_RESYNC` (default `false`)
- `MOEX_SCHEDULE_TIMEZONE` (default `Europe/Moscow`)
- `TBANK_INVEST_GRPC_ENDPOINT` (default `invest-public-api.tbank.ru:443`)
- `TBANK_INVEST_SANDBOX_GRPC_ENDPOINT` (default `sandbox-invest-public-api.tbank.ru:443`)
- `TBANK_CA_CERT_FILE` (optional path to PEM CA cert trusted for T-Bank TLS)
- `TEMPORAL_ADDRESS` (default `localhost:7233`)
- `TEMPORAL_NAMESPACE` (default `moex-sync`)
- `TEMPORAL_TASK_QUEUE` (default `moex-sync`)
- `TEMPORAL_ENABLE_SEARCH_ATTRIBUTES` (default `false`, enable only if cluster supports custom search attrs)

## Tests

```bash
cd api
task test
```

Repository tests are also available:

```bash
cd api
task test:repo
```

Tests run with an in-memory SQLite DB and the same SQL migrations.

## OpenAPI

Swagger annotations live in handlers. Generate docs with:

```bash
cd api
task api:gen
```

Generated files are written to `api/docs/`. The frontend API client consumes this spec.

## Temporal Runbook

For Temporal startup/runtime timing, schedule behavior, sync-state semantics, and monitoring commands, see:

- `docs/TEMPORAL-MOEX-OPERATIONS.md`

Manual full-history backfill is triggered via `DailySyncWorkflow` with input `{"mode":"full","from":"1997-01-01"}` (example command is in the runbook).

## MOEX Sync Admin Endpoints

The API now exposes DB-backed sync state endpoints:

- `GET /api/moex/sync/state`
- `GET /api/moex/sync/coverage`
- `GET /api/moex/sync/runs`

## T-Bank Test Trading Endpoints

Authenticated user endpoints for token connect + test buy flow:

- `GET /api/me/tbank`
- `POST /api/me/tbank/connect`
- `POST /api/me/tbank/disconnect`
- `POST /api/me/tbank/default-account`
- `GET /api/me/tbank/portfolio`
- `GET /api/me/tbank/portfolio/history`
- `GET /api/me/tbank/portfolio/composition`
- `GET /api/me/tbank/portfolio/composition/series`
- `GET /api/me/tbank/operations`
- `POST /api/me/tbank/sandbox/pay-in`
- `GET /api/me/tbank/instruments/lookup`
- `POST /api/me/tbank/test-buy`

## Unified Portfolio Endpoints

Authenticated user endpoints for provider-agnostic portfolio profiles and data:

- `GET /api/me/portfolios`
- `POST /api/me/portfolios`
- `PATCH /api/me/portfolios/:id`
- `DELETE /api/me/portfolios/:id`
- `GET /api/me/portfolios/:id/summary`
- `GET /api/me/portfolios/:id/history`
- `GET /api/me/portfolios/:id/composition`
- `GET /api/me/portfolios/:id/composition/series`
- `GET /api/me/portfolios/:id/operations`
- `POST /api/me/portfolios/:id/actions/:action`

Provider model:

- `portfolio_profiles` table stores per-user provider profiles (`provider`, `name`, default flag, config JSON, secret JSON).
- `internal/portfolio.Service` resolves profile -> provider adapter via registry.
- Current providers: `tbank` (adapter over existing `internal/tbank.Service`) and `mock` (deterministic fake data).

## T-Bank TLS CA Setup

If your runtime does not trust T-Bank certificate chain, place PEM root cert at:

- `api/certs/tbank-root-ca.pem`

This repo auto-detects that path by default for local and Docker compose (compose mounts `./api/certs` to `/root/certs` in container). `TBANK_CA_CERT_FILE` is optional override.

## Telegram Verification

For setup and flow details, see:

- `docs/TELEGRAM-VERIFICATION.md`
