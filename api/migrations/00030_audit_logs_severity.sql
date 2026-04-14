-- +goose Up
ALTER TABLE audit_logs
  ADD COLUMN severity TEXT NOT NULL DEFAULT 'info';

UPDATE audit_logs
SET severity = CASE
  WHEN action IN ('user_login', 'user_logout') THEN 'debug'
  WHEN action IN ('user_blocked', 'portfolio_rebalance_queued') THEN 'warning'
  WHEN action IN ('login_verification_denied', 'rebalance_confirmation_denied', 'portfolio_rebalance_planning_failed') THEN 'error'
  WHEN action LIKE '%_failed' OR action LIKE '%_denied' THEN 'error'
  WHEN action LIKE '%_queued' OR action LIKE '%_blocked' THEN 'warning'
  ELSE 'info'
END;

ALTER TABLE audit_logs
  ADD CONSTRAINT chk_audit_logs_severity
  CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'));

CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);

-- +goose Down
DROP INDEX IF EXISTS idx_audit_logs_severity;

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS chk_audit_logs_severity;

ALTER TABLE audit_logs
  DROP COLUMN IF EXISTS severity;
