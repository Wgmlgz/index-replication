# API

Minimal REST API with session-based auth, user management, and audit logging.

## Requirements
- Go 1.23+
- Postgres 16+

## Configuration
Environment variables live in `.env`. Key settings:
- `DATABASE_URL` (preferred)
- `RUN_MIGRATIONS` (default `true`)
- `MIGRATIONS_DIR` (optional override)

## Run
```
task run
```

## Migrations
Migrations use Goose and live in `migrations/`.

```
task migrate:up
```

## Tests
```
task test
```

Tests use an in-memory SQLite DB and apply the same SQL migrations before running.

## OpenAPI
Swagger annotations are embedded in handlers. Generate docs with:

```
task openapi:gen
```
