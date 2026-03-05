package portfolio

import "errors"

var (
	ErrInvalidProfileID = errors.New("invalid portfolio profile id")
	ErrProfileNotFound  = errors.New("portfolio profile not found")
	ErrInvalidProvider  = errors.New("invalid portfolio provider")
	ErrInvalidRequest   = errors.New("invalid portfolio request")
	ErrInvalidBenchmark = errors.New("invalid benchmark secid")
	ErrInvalidAction    = errors.New("invalid portfolio action")
	ErrProviderFailed   = errors.New("portfolio provider request failed")
)
