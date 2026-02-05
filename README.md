# Index Replication

This repo contains a Go REST API and a Next.js web app. New contributors should read these docs first:

- `README.md` (this file)
- `api/README.md` (backend)
- `web/README.md` (frontend)

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
- React Hook Form + Zod (i18next-backed error messages)
- OpenAPI Generator `typescript-axios` client in `web/src/api-client`

## Preferred Commands

The preferred way to run commands is through Taskfiles.

- Root: `task --list`
- API: `cd api && task --list`
- Web: `cd web && task --list`

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

## Repo Layout

- `api/` Go REST API
- `web/` Next.js frontend
- `Taskfile.yml` root-level tasks (currently Docker compose)
- `docker-compose.yml` local stack

## Docs Maintenance

If you change code or behavior in a way that makes any README inaccurate or incomplete, update the docs in the same change. The expectation is that docs stay correct and actionable for the next developer (human or AI).

## API Client Generation (Backend → Frontend)

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

The spec is output to `api/docs/swagger.json`. The generation script currently points to `../server/docs/swagger.json` in `web/package.json`. If your backend folder is `api/`, update that script path or add a symlink.
