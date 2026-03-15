# Auth Theme (Keycloakify)

This project contains the custom Keycloak login theme.

## Goal

- Reuse existing UI stack from `web/src` (shadcn components + design tokens)
- Avoid duplicating UI configuration in a separate `packages/ui` package

## How it works

- Theme app source: `auth-theme/src`
- Shared UI imports resolve `@/*` to `../web/src/*`
- Tailwind tokens/styles are imported from `web/src/app/globals.css`
- Keycloakify builds a theme jar consumed by the Keycloak container image
- Theme name defaults to `index-replication` and can be overridden with `KEYCLOAK_THEME_NAME`

## Commands

```bash
cd auth-theme
task install

task dev

task build

task build:keycloak
```

`task build:keycloak` requires Java + Maven on host. In Docker/Compose the theme jar is built inside the Keycloak image build, so host Maven is not required.
