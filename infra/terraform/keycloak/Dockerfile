ARG TERRAFORM_VERSION=1.7.5
ARG POSTGRESQL_PROVIDER_VERSION=1.26.0
ARG KEYCLOAK_PROVIDER_VERSION=5.3.0

FROM alpine:3.21 AS providers
ARG TARGETOS=linux
ARG TARGETARCH
ARG POSTGRESQL_PROVIDER_VERSION
ARG KEYCLOAK_PROVIDER_VERSION

RUN apk add --no-cache curl unzip

WORKDIR /providers
COPY scripts/download-providers.sh /tmp/download-providers.sh
RUN sed -i 's/\r$//' /tmp/download-providers.sh \
    && chmod +x /tmp/download-providers.sh \
    && /tmp/download-providers.sh cyrilgdn postgresql "${POSTGRESQL_PROVIDER_VERSION}" \
    && /tmp/download-providers.sh keycloak keycloak "${KEYCLOAK_PROVIDER_VERSION}"

FROM hashicorp/terraform:${TERRAFORM_VERSION}
WORKDIR /workspace/infra/terraform/keycloak

COPY --from=providers /providers/ /opt/terraform/providers/
COPY terraformrc /opt/terraform/terraformrc
COPY . ./
