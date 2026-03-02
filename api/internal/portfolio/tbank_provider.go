package portfolio

import (
	"context"
	"math"
	"strconv"
	"strings"

	"server/internal/api/dto"
	"server/internal/tbank"
)

type TBankProvider struct {
	service *tbank.Service
}

func NewTBankProvider(service *tbank.Service) *TBankProvider {
	return &TBankProvider{service: service}
}

func (p *TBankProvider) Name() string {
	return "tbank"
}

func (p *TBankProvider) Capabilities(_ context.Context, _ *Profile) dto.PortfolioCapabilities {
	return dto.PortfolioCapabilities{
		Actions: []dto.PortfolioProviderAction{
			{
				ID:    "sandbox_pay_in",
				Label: "Sandbox top up",
			},
		},
	}
}

func (p *TBankProvider) GetSummary(ctx context.Context, profile *Profile) (*dto.PortfolioSummaryResponse, error) {
	resp, err := p.service.GetAccountPortfolio(ctx, profile.UserID, profileAccountID(profile))
	if err != nil {
		return nil, err
	}

	money := make([]dto.PortfolioSummaryMoneyBalance, 0, len(resp.Money))
	for _, row := range resp.Money {
		money = append(money, dto.PortfolioSummaryMoneyBalance{
			Currency:          row.Currency,
			Available:         row.Available,
			Blocked:           row.Blocked,
			WithdrawAvailable: row.WithdrawAvailable,
			WithdrawBlocked:   row.WithdrawBlocked,
		})
	}

	positions := make([]dto.PortfolioSummaryPosition, 0, len(resp.Positions))
	for _, row := range resp.Positions {
		positions = append(positions, dto.PortfolioSummaryPosition{
			Ticker:         row.Ticker,
			InstrumentID:   row.InstrumentID,
			Name:           row.Name,
			InstrumentType: row.InstrumentType,
			Quantity:       row.Quantity,
			CurrentPrice:   row.CurrentPrice,
			CurrentValue:   row.CurrentValue,
			ExpectedYield:  row.ExpectedYield,
			Currency:       row.Currency,
		})
	}

	return &dto.PortfolioSummaryResponse{
		TotalAmountPortfolio: resp.TotalAmountPortfolio,
		TotalAmountCurrency:  resp.TotalAmountPortfolioCurrency,
		DailyYield:           resp.DailyYield,
		DailyYieldRelative:   resp.DailyYieldRelative,
		Money:                money,
		Positions:            positions,
	}, nil
}

func (p *TBankProvider) GetHistory(
	ctx context.Context,
	profile *Profile,
	from string,
	till string,
	intervalDays int,
) ([]dto.PortfolioHistoryPoint, error) {
	rows, err := p.service.GetPortfolioHistory(ctx, profile.UserID, profileAccountID(profile), from, till, intervalDays)
	if err != nil {
		return nil, err
	}

	result := make([]dto.PortfolioHistoryPoint, 0, len(rows))
	for _, row := range rows {
		result = append(result, dto.PortfolioHistoryPoint{
			TradeDate:            row.TradeDate,
			TotalAmountPortfolio: row.TotalAmountPortfolio,
			Currency:             row.TotalAmountPortfolioCurrency,
		})
	}
	return result, nil
}

func (p *TBankProvider) GetComposition(
	ctx context.Context,
	profile *Profile,
	date string,
) ([]dto.PortfolioCompositionEntry, error) {
	rows, err := p.service.GetPortfolioComposition(ctx, profile.UserID, profileAccountID(profile), date)
	if err != nil {
		return nil, err
	}

	result := make([]dto.PortfolioCompositionEntry, 0, len(rows))
	for _, row := range rows {
		result = append(result, dto.PortfolioCompositionEntry{
			TradeDate:    row.TradeDate,
			Ticker:       row.Ticker,
			InstrumentID: row.InstrumentID,
			Name:         row.Name,
			Quantity:     row.Quantity,
			CurrentPrice: row.CurrentPrice,
			CurrentValue: row.CurrentValue,
			Currency:     row.Currency,
			Weight:       row.Weight,
		})
	}
	return result, nil
}

func (p *TBankProvider) GetCompositionSeries(
	ctx context.Context,
	profile *Profile,
	tickers []string,
	topCount int,
	selectionMode string,
	selectionDate string,
	from string,
	till string,
	intervalDays int,
) (map[string][]dto.PortfolioCompositionSeriesPoint, error) {
	rows, err := p.service.GetPortfolioCompositionSeries(
		ctx,
		profile.UserID,
		profileAccountID(profile),
		tickers,
		topCount,
		selectionMode,
		selectionDate,
		from,
		till,
		intervalDays,
	)
	if err != nil {
		return nil, err
	}

	result := make(map[string][]dto.PortfolioCompositionSeriesPoint, len(rows))
	for ticker, series := range rows {
		points := make([]dto.PortfolioCompositionSeriesPoint, 0, len(series))
		for _, row := range series {
			points = append(points, dto.PortfolioCompositionSeriesPoint{
				TradeDate: row.TradeDate,
				Weight:    row.Weight,
			})
		}
		result[ticker] = points
	}
	return result, nil
}

func (p *TBankProvider) GetOperations(
	ctx context.Context,
	profile *Profile,
	cursor string,
	limit int32,
) (*dto.PortfolioOperationsHistoryResponse, error) {
	resp, err := p.service.GetOperationsHistory(ctx, profile.UserID, profileAccountID(profile), cursor, limit)
	if err != nil {
		return nil, err
	}

	items := make([]dto.PortfolioOperationHistoryItem, 0, len(resp.Items))
	for _, row := range resp.Items {
		items = append(items, dto.PortfolioOperationHistoryItem{
			Cursor:             row.Cursor,
			ID:                 row.ID,
			ParentOperationID:  row.ParentOperationID,
			Date:               row.Date,
			Type:               row.Type,
			State:              row.State,
			Name:               row.Name,
			Description:        row.Description,
			InstrumentID:       row.InstrumentID,
			Figi:               row.Figi,
			InstrumentType:     row.InstrumentType,
			Quantity:           row.Quantity,
			QuantityDone:       row.QuantityDone,
			QuantityRest:       row.QuantityRest,
			Payment:            row.Payment,
			PaymentCurrency:    row.PaymentCurrency,
			Price:              row.Price,
			PriceCurrency:      row.PriceCurrency,
			Commission:         row.Commission,
			CommissionCurrency: row.CommissionCurrency,
		})
	}

	return &dto.PortfolioOperationsHistoryResponse{
		HasNext:    resp.HasNext,
		NextCursor: resp.NextCursor,
		Items:      items,
	}, nil
}

func (p *TBankProvider) RunAction(
	ctx context.Context,
	profile *Profile,
	action string,
	payload map[string]interface{},
) (map[string]interface{}, error) {
	switch action {
	case "sandbox_pay_in":
		req := &dto.TBankSandboxPayInRequest{
			AccountID: profileAccountID(profile),
			Currency:  "RUB",
			Units:     1_000_000,
		}
		if payload != nil {
			if accountID := stringValue(payload["account_id"]); accountID != "" {
				req.AccountID = accountID
			}
			if currency := strings.ToUpper(stringValue(payload["currency"])); currency != "" {
				req.Currency = currency
			}
			if units := int64Value(payload["units"]); units > 0 {
				req.Units = units
			}
		}

		resp, err := p.service.SandboxPayIn(ctx, profile.UserID, req)
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{
			"account_id":  req.AccountID,
			"currency":    req.Currency,
			"units":       req.Units,
			"environment": resp.Environment,
		}, nil
	default:
		return nil, ErrInvalidAction
	}
}

func profileAccountID(profile *Profile) string {
	return stringValue(profile.Config["account_id"])
}

func stringValue(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return ""
	}
}

func int64Value(value interface{}) int64 {
	switch typed := value.(type) {
	case int:
		return int64(typed)
	case int64:
		return typed
	case int32:
		return int64(typed)
	case float64:
		return int64(math.Round(typed))
	case float32:
		return int64(math.Round(float64(typed)))
	case string:
		parsed, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		if err == nil {
			return parsed
		}
		return 0
	default:
		return 0
	}
}
