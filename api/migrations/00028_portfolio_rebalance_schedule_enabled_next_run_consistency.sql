-- +goose Up
UPDATE portfolio_rebalance_schedules
SET next_run_at = NULL
WHERE is_enabled = FALSE
  AND next_run_at IS NOT NULL;

UPDATE portfolio_rebalance_schedules
SET next_run_at = dtstart
WHERE is_enabled = TRUE
  AND next_run_at IS NULL;

ALTER TABLE portfolio_rebalance_schedules
ADD CONSTRAINT portfolio_rebalance_schedules_enabled_next_run_consistency_chk
CHECK (
  (is_enabled = TRUE AND next_run_at IS NOT NULL)
  OR (is_enabled = FALSE AND next_run_at IS NULL)
);

-- +goose Down
ALTER TABLE portfolio_rebalance_schedules
DROP CONSTRAINT IF EXISTS portfolio_rebalance_schedules_enabled_next_run_consistency_chk;
