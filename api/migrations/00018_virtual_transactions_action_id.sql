-- +goose Up
ALTER TABLE virtual_portfolio_transactions
  ADD COLUMN action_id TEXT NULL;

CREATE UNIQUE INDEX idx_virtual_portfolio_transactions_action_id
  ON virtual_portfolio_transactions(user_id, portfolio_profile_id, action_id);

-- +goose Down
DROP INDEX IF EXISTS idx_virtual_portfolio_transactions_action_id;

ALTER TABLE virtual_portfolio_transactions
  DROP COLUMN IF EXISTS action_id;
