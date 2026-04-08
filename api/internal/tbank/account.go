package tbank

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	"server/internal/api/dto"
	"server/internal/models"

	"google.golang.org/grpc"
	pb "opensource.tbank.ru/invest/invest-go/proto"
)

var ErrTBankSandboxOnly = errors.New("sandbox cash operations are available only in sandbox environment")

type tbankConnection struct {
	token            string
	environment      string
	defaultAccountID string
}

func (s *Service) SetDefaultAccount(
	ctx context.Context,
	userID int,
	req *dto.TBankSetDefaultAccountRequest,
) (*dto.TBankConnectionStatusResponse, error) {
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
) (*AccountPortfolioResponse, error) {
	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}

	resolvedAccountID, err := s.resolveAccountID(ctx, conn, accountID, true, userID)
	if err != nil {
		return nil, err
	}

	return s.getAccountPortfolioRaw(ctx, conn, resolvedAccountID)
}

func (s *Service) getAccountPortfolioRaw(
	ctx context.Context,
	conn *tbankConnection,
	resolvedAccountID string,
) (*AccountPortfolioResponse, error) {
	if conn == nil {
		return nil, ErrTBankNotConnected
	}
	if strings.TrimSpace(resolvedAccountID) == "" {
		return nil, ErrTBankNoAccountFound
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

	return &AccountPortfolioResponse{
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

func (s *Service) GetOperationsHistory(
	ctx context.Context,
	userID int,
	accountID string,
	cursor string,
	limit int32,
) (*OperationsHistoryResponse, error) {
	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}

	resolvedAccountID, err := s.resolveAccountID(ctx, conn, accountID, true, userID)
	if err != nil {
		return nil, err
	}

	limitValue := limit
	if limitValue <= 0 {
		limitValue = 50
	}
	if limitValue > 1000 {
		limitValue = 1000
	}

	req := &pb.GetOperationsByCursorRequest{
		AccountId: resolvedAccountID,
		Limit:     &limitValue,
	}
	if trimmedCursor := strings.TrimSpace(cursor); trimmedCursor != "" {
		req.Cursor = &trimmedCursor
	}
	state := pb.OperationState_OPERATION_STATE_EXECUTED
	req.State = &state

	var operationsResp *pb.GetOperationsByCursorResponse
	if err := s.withConnection(ctx, conn.environment, conn.token, func(callCtx context.Context, grpcConn *grpc.ClientConn) error {
		client := pb.NewOperationsServiceClient(grpcConn)
		resp, callErr := client.GetOperationsByCursor(callCtx, req)
		if callErr != nil {
			return callErr
		}
		operationsResp = resp
		return nil
	}); err != nil {
		return nil, err
	}

	return &OperationsHistoryResponse{
		Environment: conn.environment,
		AccountID:   resolvedAccountID,
		HasNext:     operationsResp.GetHasNext(),
		NextCursor:  strings.TrimSpace(operationsResp.GetNextCursor()),
		Items:       mapOperationsHistoryItems(operationsResp.GetItems()),
	}, nil
}

func (s *Service) SandboxPayIn(
	ctx context.Context,
	userID int,
	req *SandboxPayInRequest,
) (*SandboxPayInResponse, error) {
	if req == nil {
		return nil, errors.New("request is required")
	}

	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}
	if conn.environment != dto.TBankEnvironmentSandbox {
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

	return &SandboxPayInResponse{
		Environment: conn.environment,
		AccountID:   resolvedAccountID,
		Currency:    currency,
		Units:       units,
	}, nil
}

func (s *Service) SandboxPayOut(
	ctx context.Context,
	userID int,
	req *SandboxPayOutRequest,
) (*SandboxPayOutResponse, error) {
	if req == nil {
		return nil, errors.New("request is required")
	}

	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}
	if conn.environment != dto.TBankEnvironmentSandbox {
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

	if err := s.sandboxPayIn(ctx, conn.token, resolvedAccountID, currency, -units); err != nil {
		return nil, err
	}

	_ = s.auditLogger.LogUserAction(
		userID,
		models.ActionTBankSandboxPayOut,
		userID,
		map[string]interface{}{
			"environment": conn.environment,
			"account_id":  resolvedAccountID,
			"currency":    currency,
			"units":       units,
		},
	)

	return &SandboxPayOutResponse{
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
) (*dto.TBankInstrumentLookupResponse, error) {
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

	filtered := make([]dto.TBankInstrumentLookupItem, 0, len(instruments))
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

		filtered = append(filtered, dto.TBankInstrumentLookupItem{
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

	return &dto.TBankInstrumentLookupResponse{
		Query:       normalizedTicker,
		ClassCode:   normalizedClassCode,
		Instruments: filtered,
	}, nil
}

func (s *Service) ResolveOrderInstrument(
	ctx context.Context,
	userID int,
	req *ResolveOrderInstrumentRequest,
) (*ResolveOrderInstrumentResponse, error) {
	if req == nil {
		return nil, errors.New("request is required")
	}

	ticker := strings.ToUpper(strings.TrimSpace(req.Ticker))
	if ticker == "" {
		return nil, errors.New("ticker is required")
	}
	requestedInstrumentID := strings.TrimSpace(req.InstrumentID)
	side := strings.ToLower(strings.TrimSpace(req.Side))

	conn, err := s.getConnectedTBankConnection(userID)
	if err != nil {
		return nil, err
	}
	accountID, err := s.resolveAccountID(ctx, conn, req.AccountID, true, userID)
	if err != nil {
		return nil, err
	}

	portfolio, err := s.getAccountPortfolioRaw(ctx, conn, accountID)
	if err != nil {
		return nil, err
	}

	positionCandidates := make([]string, 0)
	addPositionCandidate := func(instrumentID string) {
		candidate := strings.TrimSpace(instrumentID)
		if candidate == "" {
			return
		}
		for _, existing := range positionCandidates {
			if existing == candidate || strings.EqualFold(existing, candidate) {
				return
			}
		}
		positionCandidates = append(positionCandidates, candidate)
	}
	findMatchingPositionCandidate := func(requested string) string {
		value := strings.TrimSpace(requested)
		if value == "" {
			return ""
		}
		for _, candidate := range positionCandidates {
			if candidate == value || strings.EqualFold(candidate, value) {
				return candidate
			}
		}
		return ""
	}
	for _, row := range portfolio.Positions {
		if strings.ToUpper(strings.TrimSpace(row.Ticker)) != ticker {
			continue
		}
		addPositionCandidate(row.InstrumentID)
	}

	resolveFromPositions := func() (string, bool) {
		if requestedInstrumentID != "" {
			if matched := findMatchingPositionCandidate(requestedInstrumentID); matched != "" {
				return matched, true
			}
		}
		if len(positionCandidates) == 1 {
			return positionCandidates[0], true
		}
		return "", false
	}

	if side == "sell" {
		if instrumentID, ok := resolveFromPositions(); ok {
			return &ResolveOrderInstrumentResponse{
				Environment:  conn.environment,
				AccountID:    accountID,
				Ticker:       ticker,
				InstrumentID: instrumentID,
				Source:       "portfolio_position",
			}, nil
		}
		if len(positionCandidates) > 1 {
			return nil, fmt.Errorf("%w: ticker=%s side=sell", ErrTBankInstrumentAmbiguous, ticker)
		}
		return nil, fmt.Errorf("%w: ticker=%s side=sell", ErrTBankInstrumentNotFound, ticker)
	}

	lookupResp, err := s.FindInstrumentByTicker(ctx, userID, ticker, "")
	if err != nil {
		return nil, err
	}

	lookupCandidates := make([]string, 0)
	addLookupCandidate := func(instrumentID string) {
		candidate := strings.TrimSpace(instrumentID)
		if candidate == "" {
			return
		}
		for _, existing := range lookupCandidates {
			if existing == candidate || strings.EqualFold(existing, candidate) {
				return
			}
		}
		lookupCandidates = append(lookupCandidates, candidate)
	}
	findMatchingLookupCandidate := func(requested string) string {
		value := strings.TrimSpace(requested)
		if value == "" {
			return ""
		}
		for _, candidate := range lookupCandidates {
			if candidate == value || strings.EqualFold(candidate, value) {
				return candidate
			}
		}
		return ""
	}
	if lookupResp != nil {
		for _, item := range lookupResp.Instruments {
			if strings.ToUpper(strings.TrimSpace(item.Ticker)) != ticker {
				continue
			}
			addLookupCandidate(item.InstrumentID)
		}
	}

	if requestedInstrumentID != "" {
		if matched := findMatchingLookupCandidate(requestedInstrumentID); matched != "" {
			return &ResolveOrderInstrumentResponse{
				Environment:  conn.environment,
				AccountID:    accountID,
				Ticker:       ticker,
				InstrumentID: matched,
				Source:       "find_instrument_requested",
			}, nil
		}
		if matched := findMatchingPositionCandidate(requestedInstrumentID); matched != "" {
			return &ResolveOrderInstrumentResponse{
				Environment:  conn.environment,
				AccountID:    accountID,
				Ticker:       ticker,
				InstrumentID: matched,
				Source:       "portfolio_position_requested",
			}, nil
		}
	}

	if instrumentID, ok := resolveFromPositions(); ok {
		return &ResolveOrderInstrumentResponse{
			Environment:  conn.environment,
			AccountID:    accountID,
			Ticker:       ticker,
			InstrumentID: instrumentID,
			Source:       "portfolio_position",
		}, nil
	}

	if len(lookupCandidates) == 1 {
		return &ResolveOrderInstrumentResponse{
			Environment:  conn.environment,
			AccountID:    accountID,
			Ticker:       ticker,
			InstrumentID: lookupCandidates[0],
			Source:       "find_instrument",
		}, nil
	}
	if len(lookupCandidates) > 1 {
		if lookupResp != nil {
			preferredClassCandidates := make([]string, 0, len(lookupCandidates))
			for _, item := range lookupResp.Instruments {
				if strings.ToUpper(strings.TrimSpace(item.Ticker)) != ticker {
					continue
				}
				if strings.ToUpper(strings.TrimSpace(item.ClassCode)) != "TQBR" {
					continue
				}
				instrumentID := strings.TrimSpace(item.InstrumentID)
				if instrumentID == "" {
					continue
				}
				alreadyAdded := false
				for _, existing := range preferredClassCandidates {
					if existing == instrumentID || strings.EqualFold(existing, instrumentID) {
						alreadyAdded = true
						break
					}
				}
				if !alreadyAdded {
					preferredClassCandidates = append(preferredClassCandidates, instrumentID)
				}
			}
			if len(preferredClassCandidates) == 1 {
				return &ResolveOrderInstrumentResponse{
					Environment:  conn.environment,
					AccountID:    accountID,
					Ticker:       ticker,
					InstrumentID: preferredClassCandidates[0],
					Source:       "find_instrument_temporary_preferred_class_fallback",
				}, nil
			}
		}
		return nil, fmt.Errorf("%w: ticker=%s side=%s", ErrTBankInstrumentAmbiguous, ticker, side)
	}

	return nil, fmt.Errorf("%w: ticker=%s side=%s", ErrTBankInstrumentNotFound, ticker, side)
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

	if allowSandboxOpen && conn.environment == dto.TBankEnvironmentSandbox {
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

func mergeMoneyBalances(positions *pb.PositionsResponse, withdraw *pb.WithdrawLimitsResponse) []MoneyBalance {
	byCurrency := map[string]*MoneyBalance{}

	ensure := func(currency string) *MoneyBalance {
		currency = strings.ToUpper(strings.TrimSpace(currency))
		if currency == "" {
			currency = "UNKNOWN"
		}
		if existing, ok := byCurrency[currency]; ok {
			return existing
		}
		entry := &MoneyBalance{Currency: currency}
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

	result := make([]MoneyBalance, 0, len(byCurrency))
	for _, entry := range byCurrency {
		result = append(result, *entry)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Currency < result[j].Currency
	})
	return result
}

func mapPortfolioPositions(positions []*pb.PortfolioPosition) []PortfolioPosition {
	result := make([]PortfolioPosition, 0, len(positions))
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

		result = append(result, PortfolioPosition{
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

func mapOperationsHistoryItems(items []*pb.OperationItem) []OperationHistoryItem {
	result := make([]OperationHistoryItem, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}

		instrumentID := strings.TrimSpace(item.GetInstrumentUid())
		if instrumentID == "" {
			instrumentID = strings.TrimSpace(item.GetFigi())
		}

		result = append(result, OperationHistoryItem{
			Cursor:             strings.TrimSpace(item.GetCursor()),
			ID:                 strings.TrimSpace(item.GetId()),
			ParentOperationID:  strings.TrimSpace(item.GetParentOperationId()),
			Date:               toTimePtr(item.GetDate()),
			Type:               item.GetType().String(),
			State:              item.GetState().String(),
			Name:               strings.TrimSpace(item.GetName()),
			Description:        strings.TrimSpace(item.GetDescription()),
			InstrumentID:       instrumentID,
			Figi:               strings.TrimSpace(item.GetFigi()),
			InstrumentType:     strings.TrimSpace(item.GetInstrumentType()),
			Quantity:           item.GetQuantity(),
			QuantityDone:       item.GetQuantityDone(),
			QuantityRest:       item.GetQuantityRest(),
			Payment:            moneyValueToFloat(item.GetPayment()),
			PaymentCurrency:    moneyValueCurrency(item.GetPayment()),
			Price:              moneyValueToFloat(item.GetPrice()),
			PriceCurrency:      moneyValueCurrency(item.GetPrice()),
			Commission:         moneyValueToFloat(item.GetCommission()),
			CommissionCurrency: moneyValueCurrency(item.GetCommission()),
		})
	}
	return result
}

func moneyValueCurrency(value *pb.MoneyValue) string {
	if value == nil {
		return ""
	}
	return strings.ToUpper(strings.TrimSpace(value.GetCurrency()))
}

func tickerMatchScore(ticker, classCode string, item dto.TBankInstrumentLookupItem) int {
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
