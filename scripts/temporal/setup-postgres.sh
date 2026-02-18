#!/bin/sh
set -eu

echo 'Starting PostgreSQL schema setup...'
echo 'Waiting for PostgreSQL port to be available...'
DB_HOST="${POSTGRES_SEEDS:-postgresql}"
nc -z -w 10 "$DB_HOST" 5432
echo 'PostgreSQL port is available'

temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -u "${POSTGRES_USER:-temporal}" -p 5432 --db temporal create || true
temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -u "${POSTGRES_USER:-temporal}" -p 5432 --db temporal setup-schema -v 0.0 || true
temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -u "${POSTGRES_USER:-temporal}" -p 5432 --db temporal update-schema -d /etc/temporal/schema/postgresql/v12/temporal/versioned

temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -u "${POSTGRES_USER:-temporal}" -p 5432 --db temporal_visibility create || true
temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -u "${POSTGRES_USER:-temporal}" -p 5432 --db temporal_visibility setup-schema -v 0.0 || true
temporal-sql-tool --plugin postgres12 --ep "$DB_HOST" -u "${POSTGRES_USER:-temporal}" -p 5432 --db temporal_visibility update-schema -d /etc/temporal/schema/postgresql/v12/visibility/versioned

echo 'PostgreSQL schema setup complete'
