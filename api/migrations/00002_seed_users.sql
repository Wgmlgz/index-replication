-- +goose Up
INSERT INTO users (id, username, password_hash, full_name, role_id, created_at) VALUES
  (1, 'root', '$2a$10$y3A5ISK/X2ONKo4TktathuUmAryyzcp4AzzdSKYIQWZUz91wdxsRS', 'Root User', 1, CURRENT_TIMESTAMP),
  (2, 'admin', '$2a$10$y3A5ISK/X2ONKo4TktathuUmAryyzcp4AzzdSKYIQWZUz91wdxsRS', 'Admin User', 2, CURRENT_TIMESTAMP),
  (3, 'manager', '$2a$10$y3A5ISK/X2ONKo4TktathuUmAryyzcp4AzzdSKYIQWZUz91wdxsRS', 'Manager User', 3, CURRENT_TIMESTAMP),
  (4, 'operator', '$2a$10$y3A5ISK/X2ONKo4TktathuUmAryyzcp4AzzdSKYIQWZUz91wdxsRS', 'Operator User', 4, CURRENT_TIMESTAMP),
  (5, 'observer', '$2a$10$y3A5ISK/X2ONKo4TktathuUmAryyzcp4AzzdSKYIQWZUz91wdxsRS', 'Observer User', 5, CURRENT_TIMESTAMP);

-- +goose Down
DELETE FROM users WHERE id IN (1, 2, 3, 4, 5);
