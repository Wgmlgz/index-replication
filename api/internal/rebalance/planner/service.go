package planner

import (
	"fmt"
)

type Service struct {
	registry *Registry
}

func NewService(registry *Registry) *Service {
	return &Service{registry: registry}
}

func (s *Service) Plan(input Input) (Output, error) {
	if s == nil || s.registry == nil {
		return Output{}, fmt.Errorf("%w: planner registry is nil", ErrInvalidInput)
	}
	modeKey := normalizeModeKey(input.ModeKey)
	if modeKey == "" {
		return Output{}, fmt.Errorf("%w: empty mode key", ErrInvalidModeKey)
	}

	algorithm, ok := s.registry.Resolve(modeKey)
	if !ok {
		return Output{}, fmt.Errorf("%w: %s", ErrModeNotFound, modeKey)
	}
	input.ModeKey = modeKey
	return algorithm.Plan(input)
}
