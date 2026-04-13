-- +goose Up
INSERT INTO roles (id, key, name, description) VALUES
  (1, 'root', 'Root', 'System superuser'),
  (2, 'administrator', 'Administrator', 'Administrator role'),
  (3, 'manager', 'Manager', 'Manager role'),
  (4, 'operator', 'Operator', 'Operator role'),
  (5, 'observer', 'Observer', 'Observer role');

INSERT INTO users (id, username, full_name, role_id, created_at) VALUES
  (1, 'root', 'Root User', 1, CURRENT_TIMESTAMP),
  (2, 'admin', 'Admin User', 2, CURRENT_TIMESTAMP),
  (3, 'manager', 'Manager User', 3, CURRENT_TIMESTAMP),
  (4, 'operator', 'Operator User', 4, CURRENT_TIMESTAMP),
  (5, 'observer', 'Observer User', 5, CURRENT_TIMESTAMP);

-- +goose Down
DELETE FROM users WHERE id IN (1, 2, 3, 4, 5);
DELETE FROM roles WHERE id IN (1, 2, 3, 4, 5);
