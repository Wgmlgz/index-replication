# Web App

Next.js frontend for the index replication project. The UI includes auth, user management, audit logs, and an image recognition flow.

## Requirements

- Bun 1.x
- Optional: Taskfile runner (`task`) if you want the Taskfile shortcuts

## Quick Start

1. Install dependencies:

```bash
cd web
bun install
```

2. Start the dev server:

```bash
bun run dev
```

3. Open the app:

```text
http://localhost:3000
```

## API Configuration

By default the frontend talks to the API at `http://localhost:8080`. You can change it in the Settings page inside the app, or set `NEXT_PUBLIC_API_BASE_URL` for server-side rendering.

## Taskfile

A Taskfile is available in `web/Taskfile.yml`. If you have `task` installed, you can use it.
