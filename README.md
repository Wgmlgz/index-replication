# index-replication

## Local dev

1) Copy env template:

```
cp .env.example .env
```

2) Add local hostnames to your hosts file:

```
127.0.0.1 app123.localhost api.app123.localhost adminer.app123.localhost
```

3) Start the stack:

```
docker compose up --build
```

- Web: http://app123.localhost
- API: http://api.app123.localhost/api/v1/me
- Adminer: http://adminer.app123.localhost

## OpenAPI types

Generate frontend types when the OpenAPI spec changes:

```
cd web
npm run gen:api
```

## Migrations

Migrations live in `api/migrations` and are run automatically on API start.
Disable with `RUN_MIGRATIONS=false`.
