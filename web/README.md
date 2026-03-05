# Web App (Frontend)

Next.js frontend for the index replication project. The UI includes auth, user management, audit logs, and an image recognition flow.

## Tech & Libraries

- Next.js App Router + React 19
- Tailwind CSS v4 with design tokens in `web/src/app/globals.css`
- shadcn/ui components built on Radix UI and class-variance-authority
- Axios for API calls (with Tauri adapter support)
- React Hook Form + Zod for forms and validation
- TanStack Table for data grids
- Next Themes for theme switching
- Lightweight Charts for market data visualization
- OpenAPI Generator `typescript-axios` client in `web/src/api-client`

## Preferred Commands

Use the Taskfile for all common operations:

```bash
cd web
task --list
```

Common tasks:

- `task install`
- `task dev`
- `task build`
- `task lint`
- `task api:gen`
- `task storybook`
- `task storybook:build`
- `task storybook:fixtures:record`

## Architecture & Principles

- Routing is App Router under `web/src/app/`.
- UI primitives live in `web/src/components/ui/` and follow shadcn/ui patterns.
- Shared UI and features live in `web/src/components/`.
- API access is centralized in `web/src/lib/api.ts` using a generated client.
- Portfolio (`/portfolio`) uses provider-agnostic backend endpoints (`/api/me/portfolios/:id/*`) and profile selection via `portfolio_id` URL param.
- Portfolio overview now includes a Replication tab (config CRUD only) that reads replication data embedded in
  `GET /api/me/portfolios` / `GET /api/me/portfolios/:id/summary` and writes via PUT/DELETE replication endpoints.
- MOEX data access is handled by backend endpoints via `web/src/lib/moex-client.ts`.
- Generated code in `web/src/api-client/` should not be edited manually.
- Forms use React Hook Form with Zod schemas for validation.
- Tailwind tokens and global styling are in `web/src/app/globals.css`.
- Tauri support is wired through Axios adapters in `web/src/lib/api.ts`.

## Markdown Articles

Long-form instructional content is stored as markdown articles and rendered via reusable components.

- Article files live under `web/public/articles/{lang}/{slug}.md`
- Reusable renderer: `web/src/components/content/markdown-article.tsx`
- Integration wrapper: `web/src/components/integrations/integration-instructions-article.tsx`
- Locale fallback defaults to English (`en`) when an article for the active language is missing.

Example slugs:
- `integrations/telegram-verification`
- `integrations/tbank-integration`

## Entry Points

- App Router root: `web/src/app/`
- Global layout: `web/src/app/layout.tsx`
- Home page: `web/src/app/page.tsx`

Feature routes (App Router):
- `web/src/app/login/page.tsx`
- `web/src/app/users/page.tsx`
- `web/src/app/audit-logs/page.tsx`
- `web/src/app/settings/page.tsx`
- `web/src/app/integrations/page.tsx`
- `web/src/app/dashboard/page.tsx`
- `web/src/app/moex-indexes/page.tsx`
- `web/src/app/tbank-test/page.tsx`
- `web/src/app/portfolio/page.tsx`

Telegram verification user flow is available in the Settings page. Backend/setup details are in:
- `docs/TELEGRAM-VERIFICATION.md`

MOEX indexes page docs:
- `docs/moex/MOEX-INDEXES-PAGE.md`

## API Configuration

By default in dev mode the frontend talks to the API at `http://localhost:18080`.
In browser production mode, the frontend uses same-origin `/api` so the protocol (HTTPS/HTTP) always matches the current site.
You can still override the base URL in the Settings page inside the app (`settings-api-url` in local storage). For non-browser contexts, `NEXT_PUBLIC_API_BASE_URL` is used as a fallback.

MOEX data is fetched from the backend (`/api/moex/*`). The backend ISS base URL is configured via `MOEX_BASE_URL`.

Before changing the MOEX client or screens, read `docs/moex/ISS-CONCEPTS.md`.

## API Client Generation

The API client is generated from the OpenAPI spec. Regenerate it with:

```bash
cd web
task api:gen
```

If you update API endpoints, regenerate the client and verify type usage in the affected pages/components.

## Storybook (Local)

Storybook is configured for local component development only (no Docker Compose integration).

Run Storybook:

```bash
cd web
task storybook
```

Build Storybook static output:

```bash
cd web
task storybook:build
```

Record GET fixtures from your backend for Storybook mocks:

```bash
cd web
STORYBOOK_CAPTURE_BASE_URL=http://localhost:18080 \
STORYBOOK_CAPTURE_COOKIE='session=...' \
task storybook:fixtures:record
```

Fixture capture notes:

- The recorder captures **GET-only** endpoints.
- POST/PATCH/DELETE story states are maintained as manual fixtures/handlers.
- Captured fixtures are written to `web/src/mocks/storybook/fixtures/`.
