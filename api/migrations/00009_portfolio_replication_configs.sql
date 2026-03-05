-- +goose Up
CREATE TABLE portfolio_replication_configs (
  id INTEGER PRIMARY KEY,
  portfolio_profile_id INTEGER NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  benchmark_secid TEXT NULL,
  mode_key TEXT NOT NULL DEFAULT 'full',
  mode_params JSONB NOT NULL DEFAULT '{}',
  excluded_tickers TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_profile_id) REFERENCES portfolio_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (benchmark_secid) REFERENCES moex_indexes(secid)
);

CREATE INDEX idx_portfolio_replication_configs_benchmark_secid
  ON portfolio_replication_configs(benchmark_secid);

-- +goose Down
DROP INDEX IF EXISTS idx_portfolio_replication_configs_benchmark_secid;
DROP TABLE IF EXISTS portfolio_replication_configs;
