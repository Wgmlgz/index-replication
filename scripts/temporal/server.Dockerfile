ARG TEMPORAL_VERSION=1.30.1
FROM temporalio/server:${TEMPORAL_VERSION}

COPY scripts/temporal/dynamicconfig/docker.yaml /etc/temporal/config/dynamicconfig/docker.yaml
