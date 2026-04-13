package usersettings

import "strings"

const (
	SettingLanguage = "preferences.language"
	DefaultLanguage = "en"
)

func NormalizeLanguage(raw string) string {
	lower := strings.ToLower(strings.TrimSpace(raw))
	if strings.HasPrefix(lower, "en") {
		return "en"
	}
	return DefaultLanguage
}

func ResolveLanguage(values map[string]string) string {
	if len(values) == 0 {
		return DefaultLanguage
	}
	return NormalizeLanguage(values[SettingLanguage])
}

func NormalizePatchValues(values map[string]string) map[string]string {
	if len(values) == 0 {
		return map[string]string{}
	}
	result := make(map[string]string, len(values))
	for key, value := range values {
		result[key] = value
	}
	if _, ok := result[SettingLanguage]; ok {
		result[SettingLanguage] = NormalizeLanguage(result[SettingLanguage])
	}
	return result
}
