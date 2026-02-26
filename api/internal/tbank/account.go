package tbank

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"

	"server/internal/models"

	pb "github.com/russianinvestments/invest-api-go-sdk/proto"
	"google.golang.org/grpc"
)

var ErrTBankSandboxOnly = errors.New("sandbox top-up is available only in sandbox environment")

type tbankConnection struct {
	token            string
	environment      string
	defaultAccountID string
}

func (s *Service) SetDefaultAccount(
	ctx context.Context,
	userID int,
	req *models.TBankSetDefaultAccountRequest,
) (*models.TBankConnectionStatusResponse, error) {
	if req == nil {
		return nil, errors.New("request is required")
	}
	accountID := strings.TrimSpace(req.AccountID)
	if accountID == "" {
		return nil, errors.New("account_id is required")
	}

	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}

	accounts, err := s.GetAccounts(ctx, conn.environment, conn.token)
	if err != nil {
		return nil, err
	}
	if !containsAccount(accounts, accountID) {
		return nil, errors.New("account is not available for this token")
	}

	if err := s.settingsStore.UpsertSettings(userID, map[string]string{
		tbankSettingDefaultAccountID: accountID,
	}); err != nil {
		return nil, err
	}

	_ = s.auditLogger.LogUserAction(
		userID,
		models.ActionTBankDefaultAccountUpdated,
		userID,
		map[string]interface{}{
			"environment": conn.environment,
			"account_id":  accountID,
		},
	)

	return s.GetStatus(ctx, userID)
}

func (s *Service) GetAccountPortfolio(
	ctx context.Context,
	userID int,
	accountID string,
) (*models.TBankAccountPortfolioResponse, error) {
	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}

	resolvedAccountID, err := s.resolveAccountID(ctx, conn, accountID, true, userID)
	if err != nil {
		return nil, err
	}

	var portfolioResp *pb.PortfolioResponse
	var positionsResp *pb.PositionsResponse
	var withdrawResp *pb.WithdrawLimitsResponse
	if err := s.withConnection(ctx, conn.environment, conn.token, func(callCtx context.Context, grpcConn *grpc.ClientConn) error {
		client := pb.NewOperationsServiceClient(grpcConn)

		portfolio, callErr := client.GetPortfolio(callCtx, &pb.PortfolioRequest{AccountId: resolvedAccountID})
		if callErr != nil {
			return callErr
		}
		portfolioResp = portfolio

		positions, callErr := client.GetPositions(callCtx, &pb.PositionsRequest{AccountId: resolvedAccountID})
		if callErr != nil {
			return callErr
		}
		positionsResp = positions

		withdraw, callErr := client.GetWithdrawLimits(callCtx, &pb.WithdrawLimitsRequest{AccountId: resolvedAccountID})
		if callErr != nil {
			return callErr
		}
		withdrawResp = withdraw

		return nil
	}); err != nil {
		return nil, err
	}

	return &models.TBankAccountPortfolioResponse{
		Environment:                  conn.environment,
		AccountID:                    resolvedAccountID,
		TotalAmountPortfolio:         moneyValueToFloat(portfolioResp.GetTotalAmountPortfolio()),
		TotalAmountPortfolioCurrency: strings.ToUpper(strings.TrimSpace(portfolioResp.GetTotalAmountPortfolio().GetCurrency())),
		DailyYield:                   moneyValueToFloat(portfolioResp.GetDailyYield()),
		DailyYieldRelative:           quotationToFloat(portfolioResp.GetDailyYieldRelative()),
		Money:                        mergeMoneyBalances(positionsResp, withdrawResp),
		Positions:                    mapPortfolioPositions(portfolioResp.GetPositions()),
	}, nil
}

func (s *Service) SandboxPayIn(
	ctx context.Context,
	userID int,
	req *models.TBankSandboxPayInRequest,
) (*models.TBankSandboxPayInResponse, error) {
	if req == nil {
		return nil, errors.New("request is required")
	}

	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}
	if conn.environment != models.TBankEnvironmentSandbox {
		return nil, ErrTBankSandboxOnly
	}

	units := req.Units
	if units < 0 {
		return nil, errors.New("units must be greater than 0")
	}
	if units == 0 {
		units = sandboxAutoPayInUnits
	}
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = sandboxAutoPayInCurrency
	}

	resolvedAccountID, err := s.resolveAccountID(ctx, conn, req.AccountID, true, userID)
	if err != nil {
		return nil, err
	}

	if err := s.sandboxPayIn(ctx, conn.token, resolvedAccountID, currency, units); err != nil {
		return nil, err
	}

	_ = s.auditLogger.LogUserAction(
		userID,
		models.ActionTBankSandboxPayIn,
		userID,
		map[string]interface{}{
			"environment": conn.environment,
			"account_id":  resolvedAccountID,
			"currency":    currency,
			"units":       units,
		},
	)

	return &models.TBankSandboxPayInResponse{
		Environment: conn.environment,
		AccountID:   resolvedAccountID,
		Currency:    currency,
		Units:       units,
	}, nil
}

func (s *Service) FindInstrumentByTicker(
	ctx context.Context,
	userID int,
	ticker string,
	classCode string,
) (*models.TBankInstrumentLookupResponse, error) {
	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}

	normalizedTicker := strings.ToUpper(strings.TrimSpace(ticker))
	if normalizedTicker == "" {
		return nil, errors.New("ticker is required")
	}
	normalizedClassCode := strings.ToUpper(strings.TrimSpace(classCode))

	var instruments []*pb.InstrumentShort
	if err := s.withConnection(ctx, conn.environment, conn.token, func(callCtx context.Context, grpcConn *grpc.ClientConn) error {
		client := pb.NewInstrumentsServiceClient(grpcConn)
		tradeOnly := true
		resp, callErr := client.FindInstrument(callCtx, &pb.FindInstrumentRequest{
			Query:                 normalizedTicker,
			ApiTradeAvailableFlag: &tradeOnly,
		})
		if callErr != nil {
			return callErr
		}
		instruments = resp.GetInstruments()
		return nil
	}); err != nil {
		return nil, err
	}

	filtered := make([]models.TBankInstrumentLookupItem, 0, len(instruments))
	for _, item := range instruments {
		if item == nil {
			continue
		}
		itemTicker := strings.ToUpper(strings.TrimSpace(item.GetTicker()))
		itemClassCode := strings.ToUpper(strings.TrimSpace(item.GetClassCode()))
		if itemTicker == "" {
			continue
		}
		if normalizedClassCode != "" && itemClassCode != normalizedClassCode {
			continue
		}
		if itemTicker != normalizedTicker && !strings.Contains(itemTicker, normalizedTicker) {
			continue
		}

		instrumentID := strings.TrimSpace(item.GetUid())
		if instrumentID == "" {
			instrumentID = strings.TrimSpace(item.GetFigi())
		}
		if instrumentID == "" {
			continue
		}

		filtered = append(filtered, models.TBankInstrumentLookupItem{
			InstrumentID:      instrumentID,
			Ticker:            itemTicker,
			ClassCode:         itemClassCode,
			Name:              strings.TrimSpace(item.GetName()),
			InstrumentType:    strings.TrimSpace(item.GetInstrumentType()),
			Figi:              strings.TrimSpace(item.GetFigi()),
			Uid:               strings.TrimSpace(item.GetUid()),
			PositionUid:       strings.TrimSpace(item.GetPositionUid()),
			Isin:              strings.TrimSpace(item.GetIsin()),
			Lot:               item.GetLot(),
			ApiTradeAvailable: item.GetApiTradeAvailableFlag(),
			ForIis:            item.GetForIisFlag(),
			ForQualInvestor:   item.GetForQualInvestorFlag(),
		})
	}

	sort.Slice(filtered, func(i, j int) bool {
		left := tickerMatchScore(normalizedTicker, normalizedClassCode, filtered[i])
		right := tickerMatchScore(normalizedTicker, normalizedClassCode, filtered[j])
		if left != right {
			return left < right
		}
		return filtered[i].Ticker < filtered[j].Ticker
	})

	return &models.TBankInstrumentLookupResponse{
		Query:       normalizedTicker,
		ClassCode:   normalizedClassCode,
		Instruments: filtered,
	}, nil
}

func (s *Service) getConnectedTBankConnection(userID int) (*tbankConnection, error) {
	settings, err := s.settingsStore.GetSettings(userID)
	if err != nil {
		return nil, err
	}

	token := strings.TrimSpace(settings[tbankSettingToken])
	if token == "" {
		return nil, ErrTBankNotConnected
	}

	environment := normalizeTBankEnvironment(settings[tbankSettingEnvironment])
	if _, err := s.endpointByEnvironment(environment); err != nil {
		return nil, err
	}

	return &tbankConnection{
		token:            token,
		environment:      environment,
		defaultAccountID: strings.TrimSpace(settings[tbankSettingDefaultAccountID]),
	}, nil
}

func (s *Service) resolveAccountID(
	ctx context.Context,
	conn *tbankConnection,
	requestedAccountID string,
	allowSandboxOpen bool,
	userID int,
) (string, error) {
	accountID := strings.TrimSpace(requestedAccountID)
	if accountID == "" {
		accountID = conn.defaultAccountID
	}

	accounts, err := s.GetAccounts(ctx, conn.environment, conn.token)
	if err != nil {
		return "", err
	}

	if accountID == "" {
		accountID = selectDefaultAccountID(accounts)
	}
	if accountID != "" && containsAccount(accounts, accountID) {
		return accountID, nil
	}

	if allowSandboxOpen && conn.environment == models.TBankEnvironmentSandbox {
		createdAccountID, openErr := s.openSandboxAccount(ctx, conn.token)
		if openErr != nil {
			return "", openErr
		}
		if createdAccountID != "" {
			_ = s.settingsStore.UpsertSettings(userID, map[string]string{
				tbankSettingDefaultAccountID: createdAccountID,
			})
			conn.defaultAccountID = createdAccountID
			return createdAccountID, nil
		}
	}

	return "", ErrTBankNoAccountFound
}

func mergeMoneyBalances(positions *pb.PositionsResponse, withdraw *pb.WithdrawLimitsResponse) []models.TBankMoneyBalance {
	byCurrency := map[string]*models.TBankMoneyBalance{}

	ensure := func(currency string) *models.TBankMoneyBalance {
		currency = strings.ToUpper(strings.TrimSpace(currency))
		if currency == "" {
			currency = "UNKNOWN"
		}
		if existing, ok := byCurrency[currency]; ok {
			return existing
		}
		entry := &models.TBankMoneyBalance{Currency: currency}
		byCurrency[currency] = entry
		return entry
	}

	if positions != nil {
		for _, value := range positions.GetMoney() {
			entry := ensure(value.GetCurrency())
			entry.Available += moneyValueToFloat(value)
		}
		for _, value := range positions.GetBlocked() {
			entry := ensure(value.GetCurrency())
			entry.Blocked += moneyValueToFloat(value)
		}
	}

	if withdraw != nil {
		for _, value := range withdraw.GetMoney() {
			entry := ensure(value.GetCurrency())
			entry.WithdrawAvailable += moneyValueToFloat(value)
		}
		for _, value := range withdraw.GetBlocked() {
			entry := ensure(value.GetCurrency())
			entry.WithdrawBlocked += moneyValueToFloat(value)
		}
	}

	result := make([]models.TBankMoneyBalance, 0, len(byCurrency))
	for _, entry := range byCurrency {
		result = append(result, *entry)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Currency < result[j].Currency
	})
	return result
}

func mapPortfolioPositions(positions []*pb.PortfolioPosition) []models.TBankPortfolioPosition {
	result := make([]models.TBankPortfolioPosition, 0, len(positions))
	for _, position := range positions {
		if position == nil {
			continue
		}
		currentPrice := moneyValueToFloat(position.GetCurrentPrice())
		quantity := quotationToFloat(position.GetQuantity())
		currentValue := currentPrice * quantity

		instrumentID := strings.TrimSpace(position.GetInstrumentUid())
		if instrumentID == "" {
			instrumentID = strings.TrimSpace(position.GetFigi())
		}

		result = append(result, models.TBankPortfolioPosition{
			Ticker:         strings.TrimSpace(position.GetTicker()),
			InstrumentID:   instrumentID,
			Figi:           strings.TrimSpace(position.GetFigi()),
			InstrumentType: strings.TrimSpace(position.GetInstrumentType()),
			Quantity:       quantity,
			CurrentPrice:   currentPrice,
			CurrentValue:   currentValue,
			ExpectedYield:  quotationToFloat(position.GetExpectedYield()),
			Currency:       strings.ToUpper(strings.TrimSpace(position.GetCurrentPrice().GetCurrency())),
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return math.Abs(result[i].CurrentValue) > math.Abs(result[j].CurrentValue)
	})

	return result
}

func tickerMatchScore(ticker, classCode string, item models.TBankInstrumentLookupItem) int {
	if item.Ticker == ticker && classCode != "" && item.ClassCode == classCode {
		return 0
	}
	if item.Ticker == ticker {
		return 1
	}
	if strings.HasPrefix(item.Ticker, ticker) {
		return 2
	}
	return 3
}

func moneyValueToFloat(value *pb.MoneyValue) float64 {
	if value == nil {
		return 0
	}
	return float64(value.GetUnits()) + float64(value.GetNano())/1_000_000_000
}

func quotationToFloat(value *pb.Quotation) float64 {
	if value == nil {
		return 0
	}
	return float64(value.GetUnits()) + float64(value.GetNano())/1_000_000_000
}
