-- +goose Up
ALTER TABLE portfolio_rebalance_runs
  ADD COLUMN input_json JSONB NOT NULL DEFAULT '{}';

ALTER TABLE portfolio_rebalance_runs
  ADD COLUMN output_json JSONB NOT NULL DEFAULT '{}';

-- +goose Down
ALTER TABLE portfolio_rebalance_runs
  DROP COLUMN IF EXISTS output_json;

ALTER TABLE portfolio_rebalance_runs
  DROP COLUMN IF EXISTS input_json;
