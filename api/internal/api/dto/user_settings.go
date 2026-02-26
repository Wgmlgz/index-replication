package dto

type UserSettingsResponse struct {
	Favorites []string          `json:"favorites"`
	Values    map[string]string `json:"values,omitempty"`
} //@name UserSettingsResponse

type UserSettingsPatchRequest struct {
	Favorites *[]string          `json:"favorites"`
	Values    *map[string]string `json:"values"`
} //@name UserSettingsPatchRequest
