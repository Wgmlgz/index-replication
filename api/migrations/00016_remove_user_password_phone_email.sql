-- +goose Up
ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE users DROP COLUMN phone;
ALTER TABLE users DROP COLUMN email;

-- +goose Down
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
