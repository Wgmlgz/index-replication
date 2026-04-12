-- +goose Up
ALTER TABLE portfolio_rebalance_schedules
ADD COLUMN business_day_adjustment TEXT NOT NULL DEFAULT 'strict'
CHECK (business_day_adjustment IN ('strict', 'following', 'preceding', 'modified_following', 'modified_preceding'));

-- +goose Down
ALTER TABLE portfolio_rebalance_schedules
DROP COLUMN business_day_adjustment;
