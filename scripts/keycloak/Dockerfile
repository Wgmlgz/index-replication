ARG KEYCLOAK_VERSION=26.1
ARG KEYCLOAK_THEME_NAME=index-replication

FROM node:22-bookworm AS auth_theme_builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends maven \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/auth-theme
ARG KEYCLOAK_THEME_NAME=index-replication
ENV KEYCLOAK_THEME_NAME=${KEYCLOAK_THEME_NAME}

COPY web/src /workspace/web/src

COPY auth-theme/package.json auth-theme/package-lock.json ./
RUN npm ci
RUN ln -s /workspace/auth-theme/node_modules /workspace/node_modules

COPY auth-theme/ ./
RUN npm run build-keycloak-theme

FROM quay.io/keycloak/keycloak:${KEYCLOAK_VERSION}

COPY --from=auth_theme_builder /workspace/auth-theme/dist_keycloak/*.jar /opt/keycloak/providers/
