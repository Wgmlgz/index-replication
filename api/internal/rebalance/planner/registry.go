package planner

import "strings"

type Registry struct {
	algorithms map[string]Algorithm
}

func NewRegistry(algorithms ...Algorithm) *Registry {
	registry := &Registry{algorithms: make(map[string]Algorithm, len(algorithms))}
	for _, algorithm := range algorithms {
		registry.Register(algorithm)
	}
	return registry
}

func (r *Registry) Register(algorithm Algorithm) {
	if r == nil || algorithm == nil {
		return
	}
	key := normalizeModeKey(algorithm.Key())
	if key == "" {
		return
	}
	r.algorithms[key] = algorithm
}

func (r *Registry) Resolve(modeKey string) (Algorithm, bool) {
	if r == nil {
		return nil, false
	}
	algorithm, ok := r.algorithms[normalizeModeKey(modeKey)]
	return algorithm, ok
}

func normalizeModeKey(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
