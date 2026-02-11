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
- `task lint`
- `task test`
- `task migrate:up`
- `task api:gen`

Note: `task dev` uses `go run github.com/air-verse/air@latest` for hot reloading.

## Architecture & Principles

- HTTP layer stays in `internal/handlers/` (request/response parsing, status codes).
- Business logic lives in `internal/services/`.
- Data access is isolated in `internal/repository/` using GORM.
- Auth is session-based (cookie) and enforced by middleware.
- Authorization uses Casbin policies and permission constants.
- Audit logging is a first-class concern.

## Entry Points

- `main.go` boots the server and wires config, routes, and middleware.
- `internal/routes/` defines the HTTP routes.
- `internal/handlers/` contains request handlers (HTTP layer).
- `internal/services/` contains business logic.
- `internal/repository/` contains data access (DB queries).
- `internal/models/` defines domain models.

## Where To Implement Changes

Use this mapping to locate the right layer quickly:

- Add or change endpoints: `internal/routes/`, `internal/handlers/`
- Change business rules or workflows: `internal/services/`
- Change DB queries or persistence: `internal/repository/`
- Update data structures: `internal/models/`
- Add middleware or request/response behavior: `internal/middleware/`
- Auth and session flow: `internal/handlers/auth.go`, `internal/middleware/session.go`
- User management endpoints: `internal/handlers/users.go`, `internal/repository/users.go`
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
