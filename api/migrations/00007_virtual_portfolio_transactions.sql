-- +goose Up
CREATE TABLE virtual_portfolio_transactions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  portfolio_profile_id INTEGER NOT NULL,
  operation_type TEXT NOT NULL,
  ticker TEXT,
  instrument_id TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'RUB',
  commission REAL NOT NULL DEFAULT 0,
  executed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_virtual_portfolio_transactions_user_profile_exec
  ON virtual_portfolio_transactions(user_id, portfolio_profile_id, executed_at, id);
CREATE INDEX idx_virtual_portfolio_transactions_user_profile_desc
  ON virtual_portfolio_transactions(user_id, portfolio_profile_id, executed_at DESC, id DESC);

-- +goose Down
DROP TABLE IF EXISTS virtual_portfolio_transactions;
