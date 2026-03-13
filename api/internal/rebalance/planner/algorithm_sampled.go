package planner

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

type SampledAlgorithm struct{}

func NewSampledAlgorithm() *SampledAlgorithm {
	return &SampledAlgorithm{}
}

func (a *SampledAlgorithm) Key() string {
	return "sampled"
}

func (a *SampledAlgorithm) Plan(input Input) (Output, error) {
	selected, warnings := a.buildSampledTargets(input.Benchmark, input.ModeParams)
	return buildOutput(input, selected, warnings)
}

func (a *SampledAlgorithm) buildSampledTargets(
	benchmark []BenchmarkConstituent,
	modeParams map[string]interface{},
) ([]BenchmarkConstituent, []string) {
	targetCount := resolveSampleSize(modeParams)
	warnings := make([]string, 0, 1)

	typed := make([]BenchmarkConstituent, 0, len(benchmark))
	missingWeight := make([]BenchmarkConstituent, 0)
	for _, row := range benchmark {
		if row.TargetWeight == nil {
			missingWeight = append(missingWeight, row)
			continue
		}
		if *row.TargetWeight <= 0 {
			continue
		}
		typed = append(typed, row)
	}

	sort.Slice(typed, func(i, j int) bool {
		wi := *typed[i].TargetWeight
		wj := *typed[j].TargetWeight
		if math.Abs(wi-wj) > 1e-12 {
			return wi > wj
		}
		keyI := strings.ToUpper(strings.TrimSpace(typed[i].Ticker + "::" + typed[i].InstrumentID))
		keyJ := strings.ToUpper(strings.TrimSpace(typed[j].Ticker + "::" + typed[j].InstrumentID))
		return keyI < keyJ
	})

	if targetCount == 0 {
		typed = []BenchmarkConstituent{}
	} else if targetCount > 0 && len(typed) > targetCount {
		typed = typed[:targetCount]
	}

	totalWeight := 0.0
	for _, row := range typed {
		totalWeight += *row.TargetWeight
	}
	if len(typed) > 0 && totalWeight <= 0 {
		warnings = append(warnings, "sampled_target_weight_sum_zero")
		typed = []BenchmarkConstituent{}
	}

	normalized := make([]BenchmarkConstituent, 0, len(typed)+len(missingWeight))
	for _, row := range typed {
		normalizedWeight := (*row.TargetWeight / totalWeight) * 100
		value := round(normalizedWeight, 6)
		normalized = append(normalized, BenchmarkConstituent{
			Ticker:       row.Ticker,
			InstrumentID: row.InstrumentID,
			TargetWeight: &value,
		})
	}

	if len(missingWeight) > 0 {
		sort.Slice(missingWeight, func(i, j int) bool {
			keyI := strings.ToUpper(strings.TrimSpace(missingWeight[i].Ticker + "::" + missingWeight[i].InstrumentID))
			keyJ := strings.ToUpper(strings.TrimSpace(missingWeight[j].Ticker + "::" + missingWeight[j].InstrumentID))
			return keyI < keyJ
		})
		normalized = append(normalized, missingWeight...)
	}

	return normalized, warnings
}

func resolveSampleSize(modeParams map[string]interface{}) int {
	if len(modeParams) == 0 {
		return 10
	}
	for _, key := range []string{"target_count", "top_count", "sample_size", "sampled_count"} {
		value, ok := modeParams[key]
		if !ok {
			continue
		}
		if count, ok := toInt(value); ok {
			if count < 0 {
				return 0
			}
			return count
		}
	}
	return 10
}

func toInt(value interface{}) (int, bool) {
	switch typed := value.(type) {
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case int32:
		return int(typed), true
	case float64:
		return int(math.Round(typed)), true
	case float32:
		return int(math.Round(float64(typed))), true
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return 0, false
		}
		var parsed int
		_, err := fmt.Sscanf(trimmed, "%d", &parsed)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}
