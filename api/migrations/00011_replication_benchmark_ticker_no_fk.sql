-- +goose Up
CREATE TABLE portfolio_replication_configs_new (
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

INSERT INTO portfolio_replication_configs_new (
  id,
  portfolio_profile_id,
  is_enabled,
  benchmark_secid,
  mode_key,
  mode_params,
  created_at,
  updated_at
)
SELECT
  id,
  portfolio_profile_id,
  is_enabled,
  benchmark_secid,
  mode_key,
  mode_params,
  created_at,
  updated_at
FROM portfolio_replication_configs;

DROP TABLE portfolio_replication_configs;
ALTER TABLE portfolio_replication_configs_new RENAME TO portfolio_replication_configs;

CREATE INDEX idx_portfolio_replication_configs_benchmark_secid
  ON portfolio_replication_configs(benchmark_secid);

-- +goose Down
CREATE TABLE portfolio_replication_configs_old (
  id INTEGER PRIMARY KEY,
  portfolio_profile_id INTEGER NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  benchmark_secid TEXT NULL,
  mode_key TEXT NOT NULL DEFAULT 'full',
  mode_params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_profile_id) REFERENCES portfolio_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (benchmark_secid) REFERENCES moex_indexes(secid)
);

INSERT INTO portfolio_replication_configs_old (
  id,
  portfolio_profile_id,
  is_enabled,
  benchmark_secid,
  mode_key,
  mode_params,
  created_at,
  updated_at
)
SELECT
  id,
  portfolio_profile_id,
  is_enabled,
  benchmark_secid,
  mode_key,
  mode_params,
  created_at,
  updated_at
FROM portfolio_replication_configs;

DROP TABLE portfolio_replication_configs;
ALTER TABLE portfolio_replication_configs_old RENAME TO portfolio_replication_configs;

CREATE INDEX idx_portfolio_replication_configs_benchmark_secid
  ON portfolio_replication_configs(benchmark_secid);
