-- +goose Up
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
  summary_json JSONB NOT NULL DEFAULT '{}',
  warnings_json JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_profile_id) REFERENCES portfolio_profiles(id) ON DELETE CASCADE,
  CHECK (execution_mode IN ('manual', 'automatic'))
);

CREATE INDEX idx_portfolio_rebalance_runs_user_profile_created
  ON portfolio_rebalance_runs(user_id, portfolio_profile_id, created_at DESC, id DESC);

CREATE INDEX idx_portfolio_rebalance_runs_status
  ON portfolio_rebalance_runs(status);

CREATE TABLE portfolio_rebalance_items (
  id INTEGER PRIMARY KEY,
  rebalance_run_id INTEGER NOT NULL,
  ticker TEXT NOT NULL DEFAULT '',
  instrument_id TEXT NOT NULL DEFAULT '',
  side TEXT NOT NULL DEFAULT 'buy',
  current_quantity REAL NOT NULL DEFAULT 0,
  target_quantity REAL NOT NULL DEFAULT 0,
  delta_quantity REAL NOT NULL DEFAULT 0,
  current_weight REAL NOT NULL DEFAULT 0,
  target_weight REAL NOT NULL DEFAULT 0,
  reference_price REAL NULL,
  planned_amount REAL NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rebalance_run_id) REFERENCES portfolio_rebalance_runs(id) ON DELETE CASCADE,
  CHECK (side IN ('buy', 'sell'))
);

CREATE INDEX idx_portfolio_rebalance_items_run
  ON portfolio_rebalance_items(rebalance_run_id, id);

CREATE INDEX idx_portfolio_rebalance_items_run_status
  ON portfolio_rebalance_items(rebalance_run_id, status);

CREATE TABLE portfolio_rebalance_execution_links (
  id INTEGER PRIMARY KEY,
  rebalance_run_id INTEGER NOT NULL,
  rebalance_item_id INTEGER NULL,
  provider_operation_id TEXT NULL,
  provider_operation_cursor TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rebalance_run_id) REFERENCES portfolio_rebalance_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (rebalance_item_id) REFERENCES portfolio_rebalance_items(id) ON DELETE SET NULL
);

CREATE INDEX idx_portfolio_rebalance_execution_links_run
  ON portfolio_rebalance_execution_links(rebalance_run_id, created_at DESC, id DESC);

CREATE TABLE portfolio_rebalance_confirmation_records (
  id INTEGER PRIMARY KEY,
  rebalance_run_id INTEGER NOT NULL,
  confirmation_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by INTEGER NULL,
  confirmed_by INTEGER NULL,
  payload_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rebalance_run_id) REFERENCES portfolio_rebalance_runs(id) ON DELETE CASCADE
);

CREATE INDEX idx_portfolio_rebalance_confirmation_records_run
  ON portfolio_rebalance_confirmation_records(rebalance_run_id, created_at DESC, id DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_portfolio_rebalance_confirmation_records_run;
DROP TABLE IF EXISTS portfolio_rebalance_confirmation_records;

DROP INDEX IF EXISTS idx_portfolio_rebalance_execution_links_run;
DROP TABLE IF EXISTS portfolio_rebalance_execution_links;

DROP INDEX IF EXISTS idx_portfolio_rebalance_items_run_status;
DROP INDEX IF EXISTS idx_portfolio_rebalance_items_run;
DROP TABLE IF EXISTS portfolio_rebalance_items;

DROP INDEX IF EXISTS idx_portfolio_rebalance_runs_status;
DROP INDEX IF EXISTS idx_portfolio_rebalance_runs_user_profile_created;
DROP TABLE IF EXISTS portfolio_rebalance_runs;
