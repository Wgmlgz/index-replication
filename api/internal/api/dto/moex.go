package dto

import "server/internal/moex/domain"

type MoexIndex struct {
	Secid          string   `json:"secid"`
	ShortName      string   `json:"shortName"`
	Name           string   `json:"name"`
	Currency       *string  `json:"currency"`
	Decimals       *int     `json:"decimals"`
	BoardID        *string  `json:"boardId"`
	CalcMode       *string  `json:"calcMode"`
	AnnualHigh     *float64 `json:"annualHigh"`
	AnnualLow      *float64 `json:"annualLow"`
	LastActiveDate *string  `json:"lastActiveDate"`
	HasComposition bool     `json:"hasComposition"`
} //@name MoexIndex

type MoexIndexCollection struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	Title           string `json:"title"`
	SecurityGroupID *int   `json:"securityGroupId"`
} //@name MoexIndexCollection

type MoexIndexesOverviewResponse struct {
	Indexes     []MoexIndex           `json:"indexes"`
	Collections []MoexIndexCollection `json:"collections"`
	Memberships map[string][]string   `json:"memberships"`
} //@name MoexIndexesOverviewResponse

type MoexIndexHistoryPoint struct {
	TradeDate string   `json:"tradeDate"`
	Close     *float64 `json:"close"`
	Open      *float64 `json:"open"`
	High      *float64 `json:"high"`
	Low       *float64 `json:"low"`
} //@name MoexIndexHistoryPoint

type MoexIndexCompositionEntry struct {
	IndexID          string   `json:"indexId"`
	TradeDate        string   `json:"tradeDate"`
	Ticker           string   `json:"ticker"`
	ShortName        string   `json:"shortName"`
	SecID            string   `json:"secId"`
	Weight           *float64 `json:"weight"`
	TradeSessionDate *string  `json:"tradeSessionDate"`
} //@name MoexIndexCompositionEntry

type MoexIndexTickerAnalyticsPoint struct {
	TradeDate string   `json:"tradeDate"`
	Weight    *float64 `json:"weight"`
} //@name MoexIndexTickerAnalyticsPoint

func NewMoexIndexesOverviewResponse(value domain.IndexesOverview) MoexIndexesOverviewResponse {
	indexes := make([]MoexIndex, 0, len(value.Indexes))
	for _, item := range value.Indexes {
		indexes = append(indexes, MoexIndex{
			Secid:          item.Secid,
			ShortName:      item.ShortName,
			Name:           item.Name,
			Currency:       item.Currency,
			Decimals:       item.Decimals,
			BoardID:        item.BoardID,
			CalcMode:       item.CalcMode,
			AnnualHigh:     item.AnnualHigh,
			AnnualLow:      item.AnnualLow,
			LastActiveDate: item.LastActiveDate,
			HasComposition: item.HasComposition,
		})
	}

	collections := make([]MoexIndexCollection, 0, len(value.Collections))
	for _, item := range value.Collections {
		collections = append(collections, MoexIndexCollection{
			ID:              item.ID,
			Name:            item.Name,
			Title:           item.Title,
			SecurityGroupID: item.SecurityGroupID,
		})
	}

	return MoexIndexesOverviewResponse{
		Indexes:     indexes,
		Collections: collections,
		Memberships: value.Memberships,
	}
}

func NewMoexIndexHistoryPoints(value []domain.IndexHistoryPoint) []MoexIndexHistoryPoint {
	result := make([]MoexIndexHistoryPoint, 0, len(value))
	for _, item := range value {
		result = append(result, MoexIndexHistoryPoint{
			TradeDate: item.TradeDate,
			Close:     item.Close,
			Open:      item.Open,
			High:      item.High,
			Low:       item.Low,
		})
	}
	return result
}

func NewMoexIndexCompositionEntries(value []domain.IndexCompositionEntry) []MoexIndexCompositionEntry {
	result := make([]MoexIndexCompositionEntry, 0, len(value))
	for _, item := range value {
		result = append(result, MoexIndexCompositionEntry{
			IndexID:          item.IndexID,
			TradeDate:        item.TradeDate,
			Ticker:           item.Ticker,
			ShortName:        item.ShortName,
			SecID:            item.SecID,
			Weight:           item.Weight,
			TradeSessionDate: item.TradeSessionDate,
		})
	}
	return result
}

func NewMoexIndexTickerSeries(value map[string][]domain.IndexTickerAnalyticsPoint) map[string][]MoexIndexTickerAnalyticsPoint {
	result := make(map[string][]MoexIndexTickerAnalyticsPoint, len(value))
	for ticker, points := range value {
		rows := make([]MoexIndexTickerAnalyticsPoint, 0, len(points))
		for _, item := range points {
			rows = append(rows, MoexIndexTickerAnalyticsPoint{
				TradeDate: item.TradeDate,
				Weight:    item.Weight,
			})
		}
		result[ticker] = rows
	}
	return result
}
