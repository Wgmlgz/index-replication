package models

// MoexIndex represents a single MOEX index entry.
type MoexIndex struct {
	Secid      string   `json:"secid"`
	ShortName  string   `json:"shortName"`
	Name       string   `json:"name"`
	Currency   *string  `json:"currency"`
	Decimals   *int     `json:"decimals"`
	BoardID    *string  `json:"boardId"`
	CalcMode   *string  `json:"calcMode"`
	AnnualHigh *float64 `json:"annualHigh"`
	AnnualLow  *float64 `json:"annualLow"`
}

// MoexIndexCollection represents a MOEX index collection.
type MoexIndexCollection struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Title           string `json:"title"`
	SecurityGroupID *int   `json:"securityGroupId"`
}

// MoexIndexesOverviewResponse bundles indexes and collection metadata.
type MoexIndexesOverviewResponse struct {
	Indexes     []MoexIndex           `json:"indexes"`
	Collections []MoexIndexCollection `json:"collections"`
	Memberships map[string][]string   `json:"memberships"`
}

// MoexIndexHistoryPoint represents a downsampled history point.
type MoexIndexHistoryPoint struct {
	TradeDate string   `json:"tradeDate"`
	Close     *float64 `json:"close"`
	Open      *float64 `json:"open"`
	High      *float64 `json:"high"`
	Low       *float64 `json:"low"`
}

// MoexIndexCompositionEntry represents a single composition row.
type MoexIndexCompositionEntry struct {
	IndexID          string   `json:"indexId"`
	TradeDate        string   `json:"tradeDate"`
	Ticker           string   `json:"ticker"`
	ShortName        string   `json:"shortName"`
	SecID            string   `json:"secId"`
	Weight           *float64 `json:"weight"`
	TradeSessionDate *string  `json:"tradeSessionDate"`
}

// MoexIndexTickerAnalyticsPoint represents a ticker weight point.
type MoexIndexTickerAnalyticsPoint struct {
	TradeDate string   `json:"tradeDate"`
	Weight    *float64 `json:"weight"`
}
