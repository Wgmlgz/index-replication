ARG TERRAFORM_VERSION=1.7.5
ARG POSTGRESQL_PROVIDER_VERSION=1.26.0
ARG KEYCLOAK_PROVIDER_VERSION=5.3.0

FROM alpine:3.21 AS providers
ARG TARGETOS=linux
ARG TARGETARCH=amd64
ARG POSTGRESQL_PROVIDER_VERSION
ARG KEYCLOAK_PROVIDER_VERSION

RUN apk add --no-cache curl unzip

WORKDIR /providers
RUN set -eux; \
    case "${TARGETARCH}" in amd64|arm64) ;; *) echo "unsupported TARGETARCH=${TARGETARCH}" >&2; exit 1 ;; esac; \
    curl -fsSL -o postgresql.zip "https://github.com/cyrilgdn/terraform-provider-postgresql/releases/download/v${POSTGRESQL_PROVIDER_VERSION}/terraform-provider-postgresql_${POSTGRESQL_PROVIDER_VERSION}_${TARGETOS}_${TARGETARCH}.zip"; \
    unzip -q postgresql.zip; \
    rm -f postgresql.zip; \
    curl -fsSL -o keycloak.zip "https://github.com/keycloak/terraform-provider-keycloak/releases/download/v${KEYCLOAK_PROVIDER_VERSION}/terraform-provider-keycloak_${KEYCLOAK_PROVIDER_VERSION}_${TARGETOS}_${TARGETARCH}.zip"; \
    unzip -q keycloak.zip; \
    rm -f keycloak.zip; \
    chmod +x /providers/terraform-provider-*

FROM hashicorp/terraform:${TERRAFORM_VERSION}
WORKDIR /workspace/infra/terraform/keycloak

COPY --from=providers /providers/ /opt/terraform/providers/
COPY . ./
