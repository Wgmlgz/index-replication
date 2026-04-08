-- +goose Up
ALTER TABLE portfolio_instrument_mappings
  ADD COLUMN currency TEXT NULL;

-- +goose Down
ALTER TABLE portfolio_instrument_mappings
  DROP COLUMN IF EXISTS currency;
