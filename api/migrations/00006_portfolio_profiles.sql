-- +goose Up
CREATE TABLE portfolio_profiles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  config_json TEXT NOT NULL DEFAULT '{}',
  secret_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_portfolio_profiles_user_id ON portfolio_profiles(user_id);
CREATE INDEX idx_portfolio_profiles_user_default ON portfolio_profiles(user_id, is_default);

-- +goose Down
DROP TABLE IF EXISTS portfolio_profiles;
