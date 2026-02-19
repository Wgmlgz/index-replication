ARG TEMPORAL_ADMINTOOLS_VERSION=1.28
FROM temporalio/admin-tools:${TEMPORAL_ADMINTOOLS_VERSION}

COPY scripts/temporal/setup-postgres.sh /scripts/setup-postgres.sh
COPY scripts/temporal/create-namespace.sh /scripts/create-namespace.sh
COPY scripts/temporal/register-search-attributes.sh /scripts/register-search-attributes.sh
