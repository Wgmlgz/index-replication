package dto

type TickerLogoResolveResponse struct {
	Ticker  string `json:"ticker"`
	ISIN    string `json:"isin"`
	LogoURL string `json:"logo_url"`
	Source  string `json:"source"`
}
