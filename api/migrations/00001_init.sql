-- +goose Up
CREATE TABLE roles (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  phone TEXT,
  email TEXT,
  last_active TIMESTAMP NULL,
  blocked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  comment TEXT
);
CREATE INDEX idx_users_role_id ON users(role_id);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  performed_by INTEGER NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  timestamp TIMESTAMP NOT NULL
);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

CREATE TABLE user_sessions (
  user_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  PRIMARY KEY (user_id, session_id)
);

CREATE TABLE casbin_rules (
  id INTEGER PRIMARY KEY,
  ptype TEXT,
  v0 TEXT,
  v1 TEXT,
  v2 TEXT,
  v3 TEXT,
  v4 TEXT,
  v5 TEXT,
  v6 TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  data TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  expires_at TIMESTAMP
);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

INSERT INTO roles (id, key, name, description) VALUES
  (1, 'root', 'Root', 'System superuser'),
  (2, 'administrator', 'Administrator', 'Administrator role'),
  (3, 'manager', 'Manager', 'Manager role'),
  (4, 'operator', 'Operator', 'Operator role'),
  (5, 'observer', 'Observer', 'Observer role');

-- +goose Down
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS casbin_rules;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
