-- +goose Up
ALTER TABLE users ADD COLUMN keycloak_sub TEXT;
CREATE UNIQUE INDEX idx_users_keycloak_sub ON users(keycloak_sub);

-- +goose Down
DROP INDEX IF EXISTS idx_users_keycloak_sub;
ALTER TABLE users DROP COLUMN IF EXISTS keycloak_sub;
