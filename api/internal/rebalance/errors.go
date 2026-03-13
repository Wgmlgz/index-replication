package rebalance

import "errors"

var (
	ErrInvalidRequest            = errors.New("invalid request")
	ErrInvalidProfileID          = errors.New("invalid profile id")
	ErrInvalidRebalanceID        = errors.New("invalid rebalance id")
	ErrInvalidAsOfDate           = errors.New("invalid as-of date")
	ErrInvalidExecutionMode      = errors.New("invalid execution mode")
	ErrProfileNotFound           = errors.New("portfolio profile not found")
	ErrProviderNotFound          = errors.New("portfolio provider not found")
	ErrReplicationConfigNotFound = errors.New("replication config not found")
	ErrReplicationConfigDisabled = errors.New("replication config is disabled")
	ErrBenchmarkNotConfigured    = errors.New("benchmark secid is not configured")
	ErrBenchmarkNotFound         = errors.New("benchmark not found")
	ErrRebalanceNotFound         = errors.New("rebalance run not found")
	ErrPlanningFailed            = errors.New("planning failed")
)
