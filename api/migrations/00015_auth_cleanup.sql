-- +goose Up
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS sessions;

-- +goose Down
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  data TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  expires_at TIMESTAMP
);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE user_sessions (
  user_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  PRIMARY KEY (user_id, session_id)
);
