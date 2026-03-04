package tbank

import (
	"context"
	"errors"
	"strings"

	"server/internal/api/dto"
	"server/internal/models"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	pb "opensource.tbank.ru/invest/invest-go/proto"
)

const (
	tbankSettingToken            = "integrations.tbank.token"
	tbankSettingEnvironment      = "integrations.tbank.environment"
	tbankSettingDefaultAccountID = "integrations.tbank.default_account_id"

	tbankAppName                   = "index-replication"
	sandboxAutoPayInCurrency       = "RUB"
	sandboxAutoPayInUnits    int64 = 1000000
)

var (
	ErrTBankNotConnected   = errors.New("tbank account is not connected")
	ErrTBankInvalidEnv     = errors.New("invalid tbank environment")
	ErrTBankNoAccountFound = errors.New("no account selected for test order")
	ErrTBankAuthFailed     = errors.New("tbank authentication failed")
)

type Config struct {
	TBankInvestGrpcEndpoint        string
	TBankInvestSandboxGrpcEndpoint string
	TBankCACertFile                string
}

type SettingsStore interface {
	GetSettings(userID int) (map[string]string, error)
	UpsertSettings(userID int, values map[string]string) error
}

type AuditLogger interface {
	LogUserAction(performedBy int, action string, userID int, details interface{}) error
}

type Service struct {
	cfg           Config
	settingsStore SettingsStore
	auditLogger   AuditLogger
}

func NewService(
	cfg Config,
	settingsStore SettingsStore,
	auditLogger AuditLogger,
) *Service {
	return &Service{
		cfg:           cfg,
		settingsStore: settingsStore,
		auditLogger:   auditLogger,
	}
}

func (s *Service) GetStatus(ctx context.Context, userID int) (*dto.TBankConnectionStatusResponse, error) {
	settings, err := s.settingsStore.GetSettings(userID)
	if err != nil {
		return nil, err
	}

	token := strings.TrimSpace(settings[tbankSettingToken])
	environment := normalizeTBankEnvironment(settings[tbankSettingEnvironment])
	defaultAccountID := strings.TrimSpace(settings[tbankSettingDefaultAccountID])

	resp := &dto.TBankConnectionStatusResponse{
		Connected:        token != "",
		Environment:      environment,
		TokenMasked:      maskToken(token),
		DefaultAccountID: defaultAccountID,
		Accounts:         make([]dto.TBankAccount, 0),
	}

	if token == "" {
		return resp, nil
	}

	accounts, err := s.GetAccounts(ctx, environment, token)
	if err != nil {
		resp.ConnectionError = err.Error()
		return resp, nil
	}
	resp.Accounts = accounts

	if resp.DefaultAccountID == "" {
		resp.DefaultAccountID = selectDefaultAccountID(accounts)
	}

	return resp, nil
}

func (s *Service) Connect(
	ctx context.Context,
	userID int,
	req *dto.TBankConnectRequest,
) (*dto.TBankConnectionStatusResponse, error) {
	if req == nil {
		return nil, errors.New("request is required")
	}

	token := strings.TrimSpace(req.Token)
	if token == "" {
		return nil, errors.New("token is required")
	}

	environment := normalizeTBankEnvironment(req.Environment)
	if _, err := s.endpointByEnvironment(environment); err != nil {
		return nil, err
	}

	accounts, err := s.GetAccounts(ctx, environment, token)
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 && environment == dto.TBankEnvironmentSandbox {
		createdAccountID, createErr := s.openSandboxAccount(ctx, token)
		if createErr != nil {
			return nil, createErr
		}
		accounts, err = s.GetAccounts(ctx, environment, token)
		if err != nil {
			return nil, err
		}
		if len(accounts) == 0 && createdAccountID != "" {
			accounts = append(accounts, dto.TBankAccount{
				ID:     createdAccountID,
				Name:   "Sandbox account",
				Type:   "ACCOUNT_TYPE_TINKOFF",
				Status: "ACCOUNT_STATUS_OPEN",
			})
		}
	}

	defaultAccountID := strings.TrimSpace(req.DefaultAccountID)
	if defaultAccountID == "" {
		defaultAccountID = selectDefaultAccountID(accounts)
	}
	if defaultAccountID != "" && !containsAccount(accounts, defaultAccountID) {
		return nil, errors.New("default account is not available for this token")
	}

	if err := s.settingsStore.UpsertSettings(userID, map[string]string{
		tbankSettingToken:            token,
		tbankSettingEnvironment:      environment,
		tbankSettingDefaultAccountID: defaultAccountID,
	}); err != nil {
		return nil, err
	}

	_ = s.auditLogger.LogUserAction(
		userID,
		models.ActionTBankConnected,
		userID,
		map[string]interface{}{
			"environment":        environment,
			"default_account_id": defaultAccountID,
			"accounts_count":     len(accounts),
		},
	)

	return &dto.TBankConnectionStatusResponse{
		Connected:        true,
		Environment:      environment,
		TokenMasked:      maskToken(token),
		DefaultAccountID: defaultAccountID,
		Accounts:         accounts,
	}, nil
}

func (s *Service) Disconnect(userID int) error {
	if err := s.settingsStore.UpsertSettings(userID, map[string]string{
		tbankSettingToken:            "",
		tbankSettingEnvironment:      "",
		tbankSettingDefaultAccountID: "",
	}); err != nil {
		return err
	}

	_ = s.auditLogger.LogUserAction(
		userID,
		models.ActionTBankDisconnected,
		userID,
		map[string]interface{}{},
	)
	return nil
}

func (s *Service) CreateTestBuyOrder(
	ctx context.Context,
	userID int,
	req *TestBuyRequest,
) (*TestBuyResponse, error) {
	if req == nil {
		return nil, errors.New("request is required")
	}

	instrumentID := strings.TrimSpace(req.InstrumentID)
	if instrumentID == "" {
		return nil, errors.New("instrument_id is required")
	}

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

	accountID := strings.TrimSpace(req.AccountID)
	if accountID == "" {
		accountID = strings.TrimSpace(settings[tbankSettingDefaultAccountID])
	}
	if accountID == "" {
		accounts, err := s.GetAccounts(ctx, environment, token)
		if err != nil {
			return nil, err
		}
		accountID = selectDefaultAccountID(accounts)
		if accountID == "" && environment == dto.TBankEnvironmentSandbox {
			accountID, err = s.openSandboxAccount(ctx, token)
			if err != nil {
				return nil, err
			}
		}
		if accountID != "" {
			_ = s.settingsStore.UpsertSettings(userID, map[string]string{
				tbankSettingDefaultAccountID: accountID,
			})
		}
	}
	if accountID == "" {
		return nil, ErrTBankNoAccountFound
	}

	orderReq := &pb.PostOrderRequest{
		InstrumentId: instrumentID,
		Quantity:     req.Quantity,
		Direction:    pb.OrderDirection_ORDER_DIRECTION_BUY,
		AccountId:    accountID,
		OrderType:    pb.OrderType_ORDER_TYPE_MARKET,
		OrderId:      uuid.NewString(),
	}

	orderResp, err := s.postMarketBuyOrder(ctx, environment, token, orderReq)
	if err != nil && environment == dto.TBankEnvironmentSandbox && isTBankErrorCode(err, "30034") {
		if payInErr := s.sandboxPayIn(ctx, token, accountID, sandboxAutoPayInCurrency, sandboxAutoPayInUnits); payInErr == nil {
			orderReq.OrderId = uuid.NewString()
			orderResp, err = s.postMarketBuyOrder(ctx, environment, token, orderReq)
		}
	}
	if err != nil {
		return nil, err
	}

	resp := &TestBuyResponse{
		Environment:           environment,
		AccountID:             accountID,
		InstrumentID:          instrumentID,
		Quantity:              req.Quantity,
		OrderID:               orderResp.GetOrderId(),
		ExecutionReportStatus: orderResp.GetExecutionReportStatus().String(),
		Response:              protoToMap(orderResp),
	}

	_ = s.auditLogger.LogUserAction(
		userID,
		models.ActionTBankTestBuyCreated,
		userID,
		map[string]interface{}{
			"environment":   environment,
			"account_id":    accountID,
			"instrument_id": instrumentID,
			"quantity":      req.Quantity,
			"order_id":      resp.OrderID,
		},
	)

	return resp, nil
}

func (s *Service) GetAccounts(
	ctx context.Context,
	environment string,
	token string,
) ([]dto.TBankAccount, error) {
	var accounts []dto.TBankAccount
	if err := s.withConnection(ctx, environment, token, func(callCtx context.Context, conn *grpc.ClientConn) error {
		client := pb.NewUsersServiceClient(conn)
		resp, callErr := client.GetAccounts(callCtx, &pb.GetAccountsRequest{})
		if callErr != nil {
			return callErr
		}

		accounts = make([]dto.TBankAccount, 0, len(resp.GetAccounts()))
		for _, account := range resp.GetAccounts() {
			accounts = append(accounts, dto.TBankAccount{
				ID:          account.GetId(),
				Name:        account.GetName(),
				Type:        account.GetType().String(),
				Status:      account.GetStatus().String(),
				AccessLevel: account.GetAccessLevel().String(),
				OpenedAt:    toTimePtr(account.GetOpenedDate()),
				ClosedAt:    toTimePtr(account.GetClosedDate()),
			})
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return accounts, nil
}

func (s *Service) openSandboxAccount(
	ctx context.Context,
	token string,
) (string, error) {
	var accountID string
	err := s.withConnection(ctx, dto.TBankEnvironmentSandbox, token, func(callCtx context.Context, conn *grpc.ClientConn) error {
		client := pb.NewSandboxServiceClient(conn)
		resp, callErr := client.OpenSandboxAccount(callCtx, &pb.OpenSandboxAccountRequest{})
		if callErr != nil {
			return callErr
		}
		accountID = strings.TrimSpace(resp.GetAccountId())
		return nil
	})
	if err != nil {
		return "", err
	}
	return accountID, nil
}

func (s *Service) sandboxPayIn(
	ctx context.Context,
	token string,
	accountID string,
	currency string,
	units int64,
) error {
	return s.withConnection(ctx, dto.TBankEnvironmentSandbox, token, func(callCtx context.Context, conn *grpc.ClientConn) error {
		client := pb.NewSandboxServiceClient(conn)
		_, callErr := client.SandboxPayIn(callCtx, &pb.SandboxPayInRequest{
			AccountId: accountID,
			Amount: &pb.MoneyValue{
				Currency: currency,
				Units:    units,
				Nano:     0,
			},
		})
		return callErr
	})
}

func (s *Service) postMarketBuyOrder(
	ctx context.Context,
	environment string,
	token string,
	orderReq *pb.PostOrderRequest,
) (*pb.PostOrderResponse, error) {
	var orderResp *pb.PostOrderResponse
	if err := s.withConnection(ctx, environment, token, func(callCtx context.Context, conn *grpc.ClientConn) error {
		client := pb.NewOrdersServiceClient(conn)
		resp, callErr := client.PostOrder(callCtx, orderReq)
		if callErr != nil {
			return callErr
		}
		orderResp = resp
		return nil
	}); err != nil {
		return nil, err
	}
	return orderResp, nil
}

func isTBankErrorCode(err error, code string) bool {
	if err == nil || strings.TrimSpace(code) == "" {
		return false
	}
	return strings.Contains(err.Error(), code)
}
