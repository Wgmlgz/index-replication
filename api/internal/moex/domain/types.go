package domain

type Index struct {
	Secid          string
	ShortName      string
	Name           string
	Currency       *string
	Decimals       *int
	BoardID        *string
	CalcMode       *string
	AnnualHigh     *float64
	AnnualLow      *float64
	LastActiveDate *string
	HasComposition bool
}

type IndexCollection struct {
	ID              int
	Name            string
	Title           string
	SecurityGroupID *int
}

type IndexesOverview struct {
	Indexes     []Index
	Collections []IndexCollection
	Memberships map[string][]string
}

type IndexHistoryPoint struct {
	TradeDate string
	Close     *float64
	Open      *float64
	High      *float64
	Low       *float64
}

type IndexCompositionEntry struct {
	IndexID          string
	TradeDate        string
	Ticker           string
	ShortName        string
	SecID            string
	Weight           *float64
	TradeSessionDate *string
}

type IndexTickerAnalyticsPoint struct {
	TradeDate string
	Weight    *float64
}
