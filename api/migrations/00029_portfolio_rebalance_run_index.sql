-- +goose Up
ALTER TABLE portfolio_rebalance_runs
  ADD COLUMN run_index INTEGER;

WITH ranked_runs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY portfolio_profile_id
      ORDER BY created_at ASC, id ASC
    ) AS run_index
  FROM portfolio_rebalance_runs
)
UPDATE portfolio_rebalance_runs AS runs
SET run_index = ranked_runs.run_index
FROM ranked_runs
WHERE runs.id = ranked_runs.id;

ALTER TABLE portfolio_rebalance_runs
  ALTER COLUMN run_index SET NOT NULL;

CREATE UNIQUE INDEX idx_portfolio_rebalance_runs_profile_run_index
  ON portfolio_rebalance_runs(portfolio_profile_id, run_index);

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_portfolio_rebalance_run_index()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.run_index IS NOT NULL AND NEW.run_index > 0 THEN
    RETURN NEW;
  END IF;

  -- Lock profile row to serialize per-portfolio run_index allocation.
  PERFORM 1
  FROM portfolio_profiles
  WHERE id = NEW.portfolio_profile_id
  FOR UPDATE;

  SELECT COALESCE(MAX(run_index), 0) + 1
  INTO NEW.run_index
  FROM portfolio_rebalance_runs
  WHERE portfolio_profile_id = NEW.portfolio_profile_id;

  RETURN NEW;
END;
$$;
-- +goose StatementEnd

CREATE TRIGGER trg_portfolio_rebalance_runs_set_run_index
BEFORE INSERT ON portfolio_rebalance_runs
FOR EACH ROW
EXECUTE FUNCTION set_portfolio_rebalance_run_index();

-- +goose Down
DROP TRIGGER IF EXISTS trg_portfolio_rebalance_runs_set_run_index ON portfolio_rebalance_runs;
DROP FUNCTION IF EXISTS set_portfolio_rebalance_run_index();

DROP INDEX IF EXISTS idx_portfolio_rebalance_runs_profile_run_index;

ALTER TABLE portfolio_rebalance_runs
  DROP COLUMN IF EXISTS run_index;
