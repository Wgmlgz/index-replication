package portfolio

import "strings"

func normalizeTickers(input []string) []string {
	seen := make(map[string]struct{}, len(input))
	result := make([]string, 0, len(input))
	for _, raw := range input {
		ticker := strings.ToUpper(strings.TrimSpace(raw))
		if ticker == "" {
			continue
		}
		if _, exists := seen[ticker]; exists {
			continue
		}
		seen[ticker] = struct{}{}
		result = append(result, ticker)
	}
	return result
}
