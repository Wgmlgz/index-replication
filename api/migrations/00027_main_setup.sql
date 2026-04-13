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
  keycloak_sub TEXT,
  full_name TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  last_active TIMESTAMP NULL,
  blocked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL,
  comment TEXT
);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE UNIQUE INDEX idx_users_keycloak_sub ON users(keycloak_sub);

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

CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_user_settings_user_key ON user_settings(user_id, key);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

CREATE TABLE user_favorite_indexes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  secid TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_user_favorite_indexes_user_secid ON user_favorite_indexes(user_id, secid);
CREATE INDEX idx_user_favorite_indexes_user_id ON user_favorite_indexes(user_id);

CREATE TABLE verification_challenges (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  details TEXT,
  expires_at TIMESTAMP NOT NULL,
  approved_at TIMESTAMP NULL,
  denied_at TIMESTAMP NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_verification_challenges_user_id ON verification_challenges(user_id);
CREATE INDEX idx_verification_challenges_status ON verification_challenges(status);
CREATE INDEX idx_verification_challenges_expires_at ON verification_challenges(expires_at);

CREATE TABLE telegram_connect_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_telegram_connect_tokens_user_id ON telegram_connect_tokens(user_id);
CREATE INDEX idx_telegram_connect_tokens_expires_at ON telegram_connect_tokens(expires_at);

CREATE TABLE portfolio_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  config_json TEXT NOT NULL DEFAULT '{}',
  secret_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_portfolio_profiles_user_id ON portfolio_profiles(user_id);
CREATE INDEX idx_portfolio_profiles_user_default ON portfolio_profiles(user_id, is_default);

CREATE TABLE virtual_portfolio_transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  portfolio_profile_id INTEGER NOT NULL,
  operation_type TEXT NOT NULL,
  ticker TEXT,
  instrument_id TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RUB',
  commission REAL NOT NULL DEFAULT 0,
  action_id TEXT NULL,
  executed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_virtual_portfolio_transactions_user_profile_exec
  ON virtual_portfolio_transactions(user_id, portfolio_profile_id, executed_at, id);
CREATE INDEX idx_virtual_portfolio_transactions_user_profile_desc
  ON virtual_portfolio_transactions(user_id, portfolio_profile_id, executed_at DESC, id DESC);
CREATE UNIQUE INDEX idx_virtual_portfolio_transactions_action_id
  ON virtual_portfolio_transactions(user_id, portfolio_profile_id, action_id);

CREATE TABLE portfolio_instrument_mappings (
  provider TEXT NOT NULL,
  instrument_key TEXT NOT NULL,
  ticker TEXT NULL,
  secid TEXT NOT NULL,
  board TEXT NOT NULL,
  currency TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, instrument_key)
);
CREATE INDEX idx_portfolio_instrument_mappings_provider_ticker
  ON portfolio_instrument_mappings(provider, ticker);
CREATE INDEX idx_portfolio_instrument_mappings_secid_board
  ON portfolio_instrument_mappings(secid, board);

CREATE TABLE portfolio_replication_configs (
  id INTEGER PRIMARY KEY,
  portfolio_profile_id INTEGER NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  benchmark_secid TEXT NULL,
  mode_key TEXT NOT NULL DEFAULT 'full',
  mode_params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_profile_id) REFERENCES portfolio_profiles(id) ON DELETE CASCADE
);
CREATE INDEX idx_portfolio_replication_configs_benchmark_secid
  ON portfolio_replication_configs(benchmark_secid);

CREATE TABLE portfolio_rebalance_runs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  portfolio_profile_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  benchmark_secid_snapshot TEXT NULL,
  replication_mode_key_snapshot TEXT NOT NULL,
  replication_mode_params_snapshot JSONB NOT NULL DEFAULT '{}',
  planning_params_snapshot JSONB NOT NULL DEFAULT '{}',
  execution_mode TEXT NOT NULL DEFAULT 'manual',
  confirmation_required BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft',
  as_of_date DATE NOT NULL,
  input_json JSONB NOT NULL DEFAULT '{}',
  output_json JSONB NOT NULL DEFAULT '{}',
  summary_json JSONB NOT NULL DEFAULT '{}',
  warnings_json JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NULL,
  ended_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_profile_id) REFERENCES portfolio_profiles(id) ON DELETE CASCADE,
  CHECK (execution_mode IN ('manual', 'automatic'))
);
CREATE INDEX idx_portfolio_rebalance_runs_user_profile_created
  ON portfolio_rebalance_runs(user_id, portfolio_profile_id, created_at DESC, id DESC);
CREATE INDEX idx_portfolio_rebalance_runs_status
  ON portfolio_rebalance_runs(status);

CREATE TABLE portfolio_rebalance_schedules (
  id INTEGER PRIMARY KEY,
  portfolio_profile_id INTEGER NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  dtstart TIMESTAMPTZ NOT NULL,
  rrule TEXT NOT NULL,
  business_day_adjustment TEXT NOT NULL DEFAULT 'strict'
    CHECK (business_day_adjustment IN ('strict', 'following', 'preceding', 'modified_following', 'modified_preceding')),
  next_run_at TIMESTAMPTZ NULL,
  last_run_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  last_run_id INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_profile_id) REFERENCES portfolio_profiles(id) ON DELETE CASCADE,
  CHECK (length(trim(rrule)) > 0),
  CONSTRAINT portfolio_rebalance_schedules_enabled_next_run_consistency_chk
    CHECK (
      (is_enabled = TRUE AND next_run_at IS NOT NULL)
      OR (is_enabled = FALSE AND next_run_at IS NULL)
    )
);

-- +goose Down
DROP TABLE IF EXISTS portfolio_rebalance_schedules;
DROP TABLE IF EXISTS portfolio_rebalance_runs;
DROP TABLE IF EXISTS portfolio_replication_configs;
DROP TABLE IF EXISTS portfolio_instrument_mappings;
DROP TABLE IF EXISTS virtual_portfolio_transactions;
DROP TABLE IF EXISTS portfolio_profiles;
DROP TABLE IF EXISTS telegram_connect_tokens;
DROP TABLE IF EXISTS verification_challenges;
DROP TABLE IF EXISTS user_favorite_indexes;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS casbin_rules;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
