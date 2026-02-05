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

## Architecture & Principles

- Routing is App Router under `web/src/app/`.
- UI primitives live in `web/src/components/ui/` and follow shadcn/ui patterns.
- Shared UI and features live in `web/src/components/`.
- API access is centralized in `web/src/lib/api.ts` using a generated client.
- MOEX ISS access is handled by `web/src/lib/moex-client.ts` (axios-based).
- Generated code in `web/src/api-client/` should not be edited manually.
- Forms use React Hook Form with Zod schemas for validation.
- Tailwind tokens and global styling are in `web/src/app/globals.css`.
- Tauri support is wired through Axios adapters in `web/src/lib/api.ts`.

## Entry Points

- App Router root: `web/src/app/`
- Global layout: `web/src/app/layout.tsx`
- Home page: `web/src/app/page.tsx`

Feature routes (App Router):
- `web/src/app/login/page.tsx`
- `web/src/app/users/page.tsx`
- `web/src/app/audit-logs/page.tsx`
- `web/src/app/settings/page.tsx`
- `web/src/app/dashboard/page.tsx`
- `web/src/app/moex-indexes/page.tsx`

## API Configuration

By default the frontend talks to the API at `http://localhost:8080`. You can change it in the Settings page inside the app, or set `NEXT_PUBLIC_API_BASE_URL` for server-side rendering. `web/src/lib/api.ts` also supports a local storage override.

The MOEX ISS client uses `NEXT_PUBLIC_MOEX_BASE_URL` if set; otherwise it calls `https://iss.moex.com/iss` directly.

Before changing the MOEX client or screens, read `docs/moex/ISS-CONCEPTS.md`.

## API Client Generation

The API client is generated from the OpenAPI spec. Regenerate it with:

```bash
cd web
task api:gen
```

If you update API endpoints, regenerate the client and verify type usage in the affected pages/components.
