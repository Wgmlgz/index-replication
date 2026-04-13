-- +goose Up
ALTER TABLE portfolio_rebalance_schedules
ADD COLUMN next_run_at TIMESTAMP NULL;

ALTER TABLE portfolio_rebalance_schedules
ADD COLUMN last_run_at TIMESTAMP NULL;

ALTER TABLE portfolio_rebalance_schedules
ADD COLUMN last_error TEXT NULL;

ALTER TABLE portfolio_rebalance_schedules
ADD COLUMN last_run_id INTEGER NULL;

-- +goose Down
ALTER TABLE portfolio_rebalance_schedules
DROP COLUMN IF EXISTS last_run_id;

ALTER TABLE portfolio_rebalance_schedules
DROP COLUMN IF EXISTS last_error;

ALTER TABLE portfolio_rebalance_schedules
DROP COLUMN IF EXISTS last_run_at;

ALTER TABLE portfolio_rebalance_schedules
DROP COLUMN IF EXISTS next_run_at;
