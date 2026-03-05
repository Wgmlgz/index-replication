ARG TEMPORAL_ADMINTOOLS_VERSION=1.30.1
FROM temporalio/admin-tools:${TEMPORAL_ADMINTOOLS_VERSION}

COPY scripts/temporal/setup-postgres.sh /scripts/setup-postgres.sh
