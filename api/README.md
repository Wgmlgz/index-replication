# API (Backend)

Go REST API with Keycloak JWT auth, user management, and audit logging.

## Tech & Libraries

- Go 1.23
- Gin (`github.com/gin-gonic/gin`) for HTTP routing
- GORM for ORM and DB access
- Postgres as the primary database
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
- `task telegram:dev`
- `task schedules:apply` (manual/local schedule upsert only; Docker startup auto-applies namespace/search-attributes/schedules via `infra/temporal-setup`)
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
- Auth is Keycloak JWT bearer-based and enforced by middleware.
- Authorization uses Casbin policies and permission constants.
- Audit logging is a first-class concern.

## Entry Points

- `main.go` boots the HTTP API server and wires config, routes, and middleware.
- `cmd/telegram-bot/main.go` boots the dedicated Telegram polling process.
- `internal/routes/` defines the HTTP routes.
- `internal/handlers/` contains request handlers (HTTP layer).
- `internal/api/dto/` contains HTTP DTOs and OpenAPI schema models.
- `internal/services/` contains most business logic.
- `internal/moex/` contains MOEX integration logic and read services.
- `internal/moex/domain/` contains MOEX internal/domain structs used by MOEX + repository layers.
- `internal/tbank/` contains T-Bank integration logic and gRPC client operations.
- `internal/portfolio/` contains unified portfolio orchestration and provider adapters (`tbank`, `mock`, `virtual`).
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
- Auth flow: `internal/middleware/keycloak.go`, `internal/auth/keycloak.go`
- User management endpoints: `internal/handlers/users.go`, `internal/repository/users.go`
- T-Bank integration/test trading: `internal/handlers/tbank.go`, `internal/tbank/`
- Unified portfolio API and providers: `internal/handlers/portfolio.go`, `internal/portfolio/`, `internal/repository/portfolio_profiles.go`
- Audit log endpoints and behavior: `internal/handlers/audit_log.go`, `internal/services/audit_service.go`
- Bot/token auth: `internal/middleware/token.go`
- Add or change permissions: `internal/config/permission.go`, `internal/config/model.conf`
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

- `POSTGRES_USER` (default `postgres`)
- `POSTGRES_PASSWORD` (default empty)
- `POSTGRES_HOST` (default `localhost`)
- `POSTGRES_PORT` (default `5432`)
- `POSTGRES_DB` (default `postgres`)
- `RUN_MIGRATIONS` (default `true`)
- `MIGRATIONS_DIR` (optional override)
- `KEYCLOAK_BASE_URL` (default `http://localhost:18081/auth`, used to build issuer URL; docker-compose sets internal default `http://keycloak:8080/auth`)
- `KEYCLOAK_REALM` (default `index-replication`)
- `KEYCLOAK_ISSUER_URL` (optional explicit issuer/discovery URL override)
- `KEYCLOAK_CLIENT_ID` / `KEYCLOAK_SKIP_ISSUER_CHECK` / `KEYCLOAK_SKIP_CLIENT_ID_CHECK` are available overrides,
  but docker-compose now hardcodes `KEYCLOAK_CLIENT_ID=` and both skip flags to `true`.
- `MOEX_BASE_URL` (default `https://iss.amogos.pro/iss`)
- `TELEGRAM_BOT_TOKEN` (optional; enables Telegram login verification transport)
- `TELEGRAM_BOT_USERNAME` (optional; used to build Telegram connect links)
- `TELEGRAM_SOCKS5_PROXY` (optional; SOCKS5 proxy for Telegram API calls in format `socks5://user:pass@host:port`)
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

## Portfolio MOEX Security Price Cache

`virtual` and `tbank` providers value positions by MOEX close prices (mark-to-market) for:

- `GET /api/me/portfolios/:id/summary`
- `GET /api/me/portfolios/:id/history`
- `GET /api/me/portfolios/:id/composition`

## Keycloak Auth Middleware

Protected routes require:

- `Authorization: Bearer <keycloak JWT>`

Behavior:

- Verifies JWT signature using Keycloak OIDC metadata/JWKS.
- Reads `sub` and maps to local user (`users.keycloak_sub`).
- Auto-creates a local `observer` user when `sub` is first seen.
- Populates request context (user id + role) directly from JWT-linked user.

Implementation notes:

- Prices are stored in `moex_security_history_daily`.
- Coverage tracking reuses `moex_data_coverage` with dataset key `security_history`.
- Reads are lazy: on cache miss, the requested range is fetched from MOEX shares history endpoint, upserted, and reused on subsequent requests.
- Non-trading days are valued with as-of logic (latest close on or before the anchor date, UTC date boundaries).
- If a quote is unavailable after cache fetch, valuation explicitly falls back to provider legacy price for stability.

## T-Bank Test Trading Endpoints

Authenticated user endpoints for integration status, connection, and instrument lookup:

- `GET /api/me/tbank`
- `POST /api/me/tbank/connect`
- `POST /api/me/tbank/disconnect`
- `POST /api/me/tbank/default-account`
- `GET /api/me/tbank/instruments/lookup`

Trading/top-up operations are exposed through unified portfolio profile actions:

- `POST /api/me/portfolios/:id/actions/sandbox_pay_in`
- `POST /api/me/portfolios/:id/actions/sandbox_pay_out`
- `POST /api/me/portfolios/:id/actions/buy`
- `POST /api/me/portfolios/:id/actions/sell`

Temporary resolver fallback (for rebalances and `resolve_instrument`):
- When a ticker is ambiguous across multiple trading classes, backend now prefers `class_code = TQBR`.
- This is an intentional temporary hardcoded preferred-class rule to reduce unresolved benchmark items.

## Unified Portfolio Endpoints

Authenticated user endpoints for provider-agnostic portfolio profiles and data:

- `GET /api/me/portfolios`
- `POST /api/me/portfolios`
- `PATCH /api/me/portfolios/:id`
- `DELETE /api/me/portfolios/:id`
- `PUT /api/me/portfolios/:id/replication`
- `DELETE /api/me/portfolios/:id/replication`
- `POST /api/me/portfolios/:id/rebalances`
- `GET /api/me/portfolios/:id/rebalances`
- `GET /api/me/portfolios/:id/rebalances/:rebalanceId`
- `GET /api/me/portfolios/:id/rebalances/:rebalanceId/execution`
- `DELETE /api/me/portfolios/:id/rebalances/:rebalanceId`
- `POST /api/me/portfolios/:id/rebalances/:rebalanceId/execute`
- `GET /api/me/portfolios/:id/summary`
- `GET /api/me/portfolios/:id/history`
- `GET /api/me/portfolios/:id/composition`
- `GET /api/me/portfolios/:id/composition/series`
- `GET /api/me/portfolios/:id/operations`
- `POST /api/me/portfolios/:id/actions/:action`

Action payload requirement:
- `POST /api/me/portfolios/:id/actions/:action` now requires `payload.action_id` (UUID string).
- The same `action_id` can be reused by callers (for example Temporal retries) to keep provider-side execution idempotent.

Rebalance planning and execution:
- `POST /api/me/portfolios/:id/rebalances` is fully async: it creates a run with status
  `planning_queued`, starts Temporal workflow `rebalance.plan`, and returns `202 Accepted`.
- Planning workflow transitions:
  - `planning_queued -> planning -> draft` on success
  - `planning_queued -> planning -> planning_failed` on planning error
- `POST /api/me/portfolios/:id/rebalances/:rebalanceId/execute` starts Temporal workflow
  orchestration only for runs in `draft` or `failed` status.
- `GET /api/me/portfolios/:id/rebalances/:rebalanceId/execution` is Temporal-driven and returns
  pollable execution status (run status, progress counters, item statuses, execution links) from
  workflow heartbeat/result without DB fallback.
- During execution, DB is not used as execution state storage: per-item statuses and execution links
  are not written to DB in-flight; DB keeps draft payloads plus run timestamps/final terminal status.
- Current automatic execution activity is implemented for `virtual` and `tbank` provider runs.

Provider model:

- `portfolio_profiles` table stores per-user provider profiles (`provider`, `name`, default flag, config JSON, secret JSON).
- `portfolio_replication_configs` stores optional per-profile replication config
  (`is_enabled`, `benchmark_secid`, `mode_key`, `mode_params`), where `benchmark_secid`
  is stored as a plain ticker string (not a foreign-key reference).
- `internal/portfolio.Service` resolves profile -> provider adapter via registry.
- `GET /api/me/portfolios` and `GET /api/me/portfolios/:id/summary` now embed `replication` block
  (or `null` when config is absent), so the frontend can read replication config without extra read endpoints.
- Current providers:
  - `tbank` (adapter over existing `internal/tbank.Service`)
  - `mock` (deterministic fake data)
  - `virtual` (stateful simulated portfolio backed by persisted transactions in `virtual_portfolio_transactions`)

## T-Bank TLS CA Setup

If your runtime does not trust T-Bank certificate chain, place PEM root cert at:

- `api/certs/tbank-root-ca.pem`

This repo auto-detects that path by default for local and Docker compose (compose mounts `./api/certs` to `/root/certs` in container). `TBANK_CA_CERT_FILE` is optional override.

## Telegram Verification

For setup and flow details, see:

- `docs/TELEGRAM-VERIFICATION.md`
