-- +goose Up
CREATE SCHEMA moex;

CREATE TABLE moex.indexes (
  secid TEXT PRIMARY KEY,
  short_name TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NULL,
  decimals INTEGER NULL,
  board_id TEXT NULL,
  calc_mode TEXT NULL,
  annual_high REAL NULL,
  annual_low REAL NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moex.index_collections (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  security_group_id INTEGER NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE moex.index_collection_memberships (
  secid TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (secid, collection_name)
);
CREATE INDEX idx_moex_memberships_collection ON moex.index_collection_memberships(collection_name);

CREATE TABLE moex.index_history_daily (
  secid TEXT NOT NULL,
  trade_date DATE NOT NULL,
  open REAL NULL,
  high REAL NULL,
  low REAL NULL,
  close REAL NULL,
  source_updated_at TIMESTAMP NULL,
  ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (secid, trade_date)
);
CREATE INDEX idx_moex_history_secid_trade_date_desc ON moex.index_history_daily(secid, trade_date DESC);

CREATE TABLE moex.index_composition_daily (
  index_id TEXT NOT NULL,
  trade_date DATE NOT NULL,
  ticker TEXT NOT NULL,
  secid TEXT NULL,
  short_name TEXT NULL,
  weight REAL NULL,
  trade_session_date DATE NULL,
  ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (index_id, trade_date, ticker)
);
CREATE INDEX idx_moex_composition_index_trade_date_desc ON moex.index_composition_daily(index_id, trade_date DESC);
CREATE INDEX idx_moex_composition_index_ticker_trade_date_desc ON moex.index_composition_daily(index_id, ticker, trade_date DESC);

CREATE TABLE moex.security_history_daily (
  secid TEXT NOT NULL,
  board TEXT NOT NULL,
  trade_date DATE NOT NULL,
  open REAL NULL,
  high REAL NULL,
  low REAL NULL,
  close REAL NULL,
  source_updated_at TIMESTAMP NULL,
  ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (secid, board, trade_date)
);
CREATE INDEX idx_moex_security_history_secid_board_trade_date_desc
  ON moex.security_history_daily(secid, board, trade_date DESC);

CREATE TABLE moex.sync_state (
  dataset TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  checked_through_date DATE NULL,
  immutable_before_date DATE NULL,
  mutable_since_date DATE NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  last_success_at TIMESTAMP NULL,
  last_attempt_at TIMESTAMP NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (dataset, entity_key)
);

CREATE TABLE moex.data_coverage (
  dataset TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (dataset, entity_key, from_date, to_date)
);
CREATE INDEX idx_moex_coverage_dataset_entity ON moex.data_coverage(dataset, entity_key);

CREATE TABLE moex.sync_runs (
  run_id TEXT PRIMARY KEY,
  workflow_id TEXT NULL,
  workflow_run_id TEXT NULL,
  dataset TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  fetched_rows INTEGER NOT NULL DEFAULT 0,
  upserted_rows INTEGER NOT NULL DEFAULT 0,
  error_text TEXT NULL,
  details TEXT NULL
);
CREATE INDEX idx_moex_sync_runs_dataset_entity_started ON moex.sync_runs(dataset, entity_key, started_at DESC);

-- +goose Down
DROP TABLE IF EXISTS moex.sync_runs;
DROP TABLE IF EXISTS moex.data_coverage;
DROP TABLE IF EXISTS moex.sync_state;
DROP TABLE IF EXISTS moex.security_history_daily;
DROP TABLE IF EXISTS moex.index_composition_daily;
DROP TABLE IF EXISTS moex.index_history_daily;
DROP TABLE IF EXISTS moex.index_collection_memberships;
DROP TABLE IF EXISTS moex.index_collections;
DROP TABLE IF EXISTS moex.indexes;
DROP SCHEMA IF EXISTS moex;
