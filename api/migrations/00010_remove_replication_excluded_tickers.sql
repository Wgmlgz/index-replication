-- +goose Up
ALTER TABLE portfolio_replication_configs
  DROP COLUMN excluded_tickers;

-- +goose Down
ALTER TABLE portfolio_replication_configs
  ADD COLUMN excluded_tickers TEXT[] NOT NULL DEFAULT '{}';
