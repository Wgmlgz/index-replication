-- +goose Up
CREATE TABLE verification_challenges (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  details TEXT,
  expires_at TIMESTAMP NOT NULL,
  approved_at TIMESTAMP NULL,
  denied_at TIMESTAMP NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_verification_challenges_user_id ON verification_challenges(user_id);
CREATE INDEX idx_verification_challenges_status ON verification_challenges(status);
CREATE INDEX idx_verification_challenges_expires_at ON verification_challenges(expires_at);

CREATE TABLE telegram_connect_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_telegram_connect_tokens_user_id ON telegram_connect_tokens(user_id);
CREATE INDEX idx_telegram_connect_tokens_expires_at ON telegram_connect_tokens(expires_at);

-- +goose Down
DROP TABLE IF EXISTS telegram_connect_tokens;
DROP TABLE IF EXISTS verification_challenges;
