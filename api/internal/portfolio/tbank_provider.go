package portfolio

import (
	"context"
	"math"
	"strconv"
	"strings"
	"time"

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
			{
				ID:    "sandbox_pay_out",
				Label: "Sandbox withdraw",
			},
			{
				ID:    "buy",
				Label: "Buy",
			},
			{
				ID:    "sell",
				Label: "Sell",
			},
		},
	}
}

func (p *TBankProvider) GetSummary(ctx context.Context, profile *Profile) (*dto.PortfolioSummaryResponse, error) {
	resp, err := p.service.GetAccountPortfolio(ctx, profile.UserID, profileAccountID(profile))
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	today := now.Format("2006-01-02")
	composition, compositionErr := p.service.GetPortfolioComposition(ctx, profile.UserID, profileAccountID(profile), today)
	if compositionErr == nil {
		byInstrument := make(map[string]tbank.PortfolioPosition, len(resp.Positions))
		for _, row := range resp.Positions {
			byInstrument[row.InstrumentID] = row
		}
		positions := make([]dto.PortfolioSummaryPosition, 0, len(composition))
		totalPositions := 0.0
		for _, row := range composition {
			matched := byInstrument[row.InstrumentID]
			positions = append(positions, dto.PortfolioSummaryPosition{
				Ticker:         row.Ticker,
				InstrumentID:   row.InstrumentID,
				Name:           row.Name,
				InstrumentType: matched.InstrumentType,
				Quantity:       row.Quantity,
				CurrentPrice:   row.CurrentPrice,
				CurrentValue:   row.CurrentValue,
				ExpectedYield:  matched.ExpectedYield,
				Currency:       row.Currency,
			})
			if row.CurrentValue > 0 {
				totalPositions += row.CurrentValue
			}
		}

		cashTotal := 0.0
		money := make([]dto.PortfolioSummaryMoneyBalance, 0, len(resp.Money))
		for _, row := range resp.Money {
			money = append(money, dto.PortfolioSummaryMoneyBalance{
				Currency:          row.Currency,
				Available:         row.Available,
				Blocked:           row.Blocked,
				WithdrawAvailable: row.WithdrawAvailable,
				WithdrawBlocked:   row.WithdrawBlocked,
			})
			cashTotal += row.Available + row.Blocked
		}

		dailyYield := resp.DailyYield
		dailyYieldRelative := resp.DailyYieldRelative
		yesterday := now.AddDate(0, 0, -1).Format("2006-01-02")
		if history, historyErr := p.service.GetPortfolioHistory(ctx, profile.UserID, profileAccountID(profile), yesterday, today, 1); historyErr == nil && len(history) > 0 {
			todayTotal := history[len(history)-1].TotalAmountPortfolio
			previousTotal := todayTotal
			if len(history) > 1 {
				previousTotal = history[len(history)-2].TotalAmountPortfolio
			}
			dailyYield = roundFloat(todayTotal-previousTotal, 2)
			dailyYieldRelative = 0
			if previousTotal > 0 {
				dailyYieldRelative = roundFloat((dailyYield/previousTotal)*100, 4)
			}
		}

		return &dto.PortfolioSummaryResponse{
			TotalAmountPortfolio: roundFloat(cashTotal+totalPositions, 2),
			TotalAmountCurrency:  resp.TotalAmountPortfolioCurrency,
			DailyYield:           dailyYield,
			DailyYieldRelative:   dailyYieldRelative,
			Money:                money,
			Positions:            positions,
		}, nil
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
	actionID := ""
	if payload != nil {
		actionID = strings.TrimSpace(stringValue(payload["action_id"]))
	}
	if actionID == "" {
		return nil, ErrInvalidRequest
	}

	switch action {
	case "sandbox_pay_in":
		req := &tbank.SandboxPayInRequest{
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
			"action_id":   actionID,
		}, nil
	case "sandbox_pay_out":
		req := &tbank.SandboxPayOutRequest{
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

		resp, err := p.service.SandboxPayOut(ctx, profile.UserID, req)
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{
			"account_id":  req.AccountID,
			"currency":    req.Currency,
			"units":       req.Units,
			"environment": resp.Environment,
			"action_id":   actionID,
		}, nil
	case "buy":
		return p.runTradeAction(ctx, profile, actionID, payload, false)
	case "sell":
		return p.runTradeAction(ctx, profile, actionID, payload, true)
	case "resolve_instrument":
		return p.runResolveInstrumentAction(ctx, profile, actionID, payload)
	default:
		return nil, ErrInvalidAction
	}
}

func (p *TBankProvider) runResolveInstrumentAction(
	ctx context.Context,
	profile *Profile,
	actionID string,
	payload map[string]interface{},
) (map[string]interface{}, error) {
	req := &tbank.ResolveOrderInstrumentRequest{
		AccountID: profileAccountID(profile),
	}
	if payload != nil {
		if accountID := stringValue(payload["account_id"]); accountID != "" {
			req.AccountID = accountID
		}
		if ticker := strings.ToUpper(stringValue(payload["ticker"])); ticker != "" {
			req.Ticker = ticker
		}
		if instrumentID := stringValue(payload["instrument_id"]); instrumentID != "" {
			req.InstrumentID = instrumentID
		}
		if side := strings.ToLower(stringValue(payload["side"])); side != "" {
			req.Side = side
		}
	}
	if req.Ticker == "" {
		return nil, ErrInvalidRequest
	}

	resp, err := p.service.ResolveOrderInstrument(ctx, profile.UserID, req)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"environment":       resp.Environment,
		"account_id":        resp.AccountID,
		"ticker":            resp.Ticker,
		"instrument_id":     resp.InstrumentID,
		"resolution_source": resp.Source,
		"action_id":         actionID,
	}, nil
}

func (p *TBankProvider) runTradeAction(
	ctx context.Context,
	profile *Profile,
	actionID string,
	payload map[string]interface{},
	isSell bool,
) (map[string]interface{}, error) {
	req := &tbank.MarketOrderRequest{
		AccountID:    profileAccountID(profile),
		InstrumentID: "",
		Quantity:     0,
		ActionID:     actionID,
	}
	if payload != nil {
		if accountID := stringValue(payload["account_id"]); accountID != "" {
			req.AccountID = accountID
		}
		if instrumentID := stringValue(payload["instrument_id"]); instrumentID != "" {
			req.InstrumentID = instrumentID
		}
		if quantity := int64Value(payload["quantity"]); quantity > 0 {
			req.Quantity = quantity
		}
	}
	if req.InstrumentID == "" {
		return nil, ErrInvalidRequest
	}
	if req.Quantity <= 0 {
		return nil, ErrInvalidRequest
	}

	var (
		orderResp *tbank.MarketOrderResponse
		err       error
	)
	if isSell {
		orderResp, err = p.service.CreateMarketSellOrder(ctx, profile.UserID, req)
	} else {
		orderResp, err = p.service.CreateMarketBuyOrder(ctx, profile.UserID, req)
	}
	if err != nil {
		return nil, err
	}
	if orderResp == nil {
		return nil, ErrInvalidRequest
	}

	result := map[string]interface{}{
		"environment":             orderResp.Environment,
		"account_id":              orderResp.AccountID,
		"instrument_id":           orderResp.InstrumentID,
		"quantity":                orderResp.Quantity,
		"order_id":                orderResp.OrderID,
		"operation_id":            orderResp.OrderID,
		"execution_report_status": orderResp.ExecutionReportStatus,
		"response":                orderResp.Response,
		"action_id":               actionID,
	}
	if isSell {
		result["side"] = "sell"
	} else {
		result["side"] = "buy"
	}
	return result, nil
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
