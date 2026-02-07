-- +goose Up
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_user_settings_user_key ON user_settings(user_id, key);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

CREATE TABLE user_favorite_indexes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  secid TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_user_favorite_indexes_user_secid ON user_favorite_indexes(user_id, secid);
CREATE INDEX idx_user_favorite_indexes_user_id ON user_favorite_indexes(user_id);

-- +goose Down
DROP TABLE IF EXISTS user_favorite_indexes;
DROP TABLE IF EXISTS user_settings;
