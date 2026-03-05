-- +goose Up
CREATE TABLE moex_security_history_daily (
  secid TEXT NOT NULL,
  board TEXT NOT NULL,
  trade_date DATE NOT NULL,
  open REAL NULL,
  high REAL NULL,
  low REAL NULL,
  close REAL NULL,
  source_updated_at TIMESTAMP NULL,
  ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (secid, board, trade_date)
);
CREATE INDEX idx_moex_security_history_secid_board_trade_date_desc
  ON moex_security_history_daily(secid, board, trade_date DESC);

CREATE TABLE portfolio_instrument_mappings (
  provider TEXT NOT NULL,
  instrument_key TEXT NOT NULL,
  ticker TEXT NULL,
  secid TEXT NOT NULL,
  board TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, instrument_key)
);
CREATE INDEX idx_portfolio_instrument_mappings_provider_ticker
  ON portfolio_instrument_mappings(provider, ticker);
CREATE INDEX idx_portfolio_instrument_mappings_secid_board
  ON portfolio_instrument_mappings(secid, board);

-- +goose Down
DROP TABLE IF EXISTS portfolio_instrument_mappings;
DROP TABLE IF EXISTS moex_security_history_daily;
