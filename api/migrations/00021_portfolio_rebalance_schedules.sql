-- +goose Up
CREATE TABLE portfolio_rebalance_schedules (
  id INTEGER PRIMARY KEY,
  portfolio_profile_id INTEGER NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  dtstart TIMESTAMP NOT NULL,
  rrule TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portfolio_profile_id) REFERENCES portfolio_profiles(id) ON DELETE CASCADE,
  CHECK (length(trim(rrule)) > 0)
);

-- +goose Down
DROP TABLE IF EXISTS portfolio_rebalance_schedules;
