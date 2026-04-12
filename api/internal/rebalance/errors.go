package rebalance

import "errors"

var (
	ErrInvalidRequest               = errors.New("invalid request")
	ErrInvalidProfileID             = errors.New("invalid profile id")
	ErrInvalidRebalanceID           = errors.New("invalid rebalance id")
	ErrInvalidAsOfDate              = errors.New("invalid as-of date")
	ErrInvalidExecutionMode         = errors.New("invalid execution mode")
	ErrProfileNotFound              = errors.New("portfolio profile not found")
	ErrProviderNotFound             = errors.New("portfolio provider not found")
	ErrReplicationConfigNotFound    = errors.New("replication config not found")
	ErrReplicationConfigDisabled    = errors.New("replication config is disabled")
	ErrBenchmarkNotConfigured       = errors.New("benchmark secid is not configured")
	ErrBenchmarkNotFound            = errors.New("benchmark not found")
	ErrRebalanceNotFound            = errors.New("rebalance run not found")
	ErrRebalanceNotExecutable       = errors.New("rebalance run is not executable")
	ErrPlanningUnavailable          = errors.New("rebalance planning is unavailable")
	ErrExecutionUnavailable         = errors.New("rebalance execution is unavailable")
	ErrSchedulePreviewUnavailable   = errors.New("rebalance schedule preview is unavailable")
	ErrExecutionNotFound            = errors.New("rebalance execution workflow not found")
	ErrExecutionProviderUnsupported = errors.New("rebalance execution is supported only for virtual and tbank providers")
	ErrPlanningFailed               = errors.New("planning failed")
)
