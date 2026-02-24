package services

import (
	"context"
	"errors"
	"strings"

	"server/internal/config"
	"server/internal/models"
	"server/internal/repository"

	"github.com/google/uuid"
	pb "github.com/russianinvestments/invest-api-go-sdk/proto"
	"google.golang.org/grpc"
)

const (
	tbankSettingToken            = "integrations.tbank.token"
	tbankSettingEnvironment      = "integrations.tbank.environment"
	tbankSettingDefaultAccountID = "integrations.tbank.default_account_id"

	tbankAppName = "index-replication"
)

var (
	ErrTBankNotConnected   = errors.New("tbank account is not connected")
	ErrTBankInvalidEnv     = errors.New("invalid tbank environment")
	ErrTBankNoAccountFound = errors.New("no account selected for test order")
	ErrTBankAuthFailed     = errors.New("tbank authentication failed")
)

type TBankService struct {
	cfg              *config.Config
	userSettingsRepo *repository.UserSettingsRepository
	auditService     *AuditService
}

func NewTBankService(
	cfg *config.Config,
	userSettingsRepo *repository.UserSettingsRepository,
	auditService *AuditService,
) *TBankService {
	return &TBankService{
		cfg:              cfg,
		userSettingsRepo: userSettingsRepo,
		auditService:     auditService,
	}
}

func (s *TBankService) GetStatus(ctx context.Context, userID int) (*models.TBankConnectionStatusResponse, error) {
	settings, err := s.userSettingsRepo.GetSettings(userID)
	if err != nil {
		return nil, err
	}

	token := strings.TrimSpace(settings[tbankSettingToken])
	environment := normalizeTBankEnvironment(settings[tbankSettingEnvironment])
	defaultAccountID := strings.TrimSpace(settings[tbankSettingDefaultAccountID])

	resp := &models.TBankConnectionStatusResponse{
		Connected:        token != "",
		Environment:      environment,
		TokenMasked:      maskToken(token),
		DefaultAccountID: defaultAccountID,
		Accounts:         make([]models.TBankAccount, 0),
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

	if resp.DefaultAccountID == "" && len(accounts) > 0 {
		resp.DefaultAccountID = accounts[0].ID
	}

	return resp, nil
}

func (s *TBankService) Connect(
	ctx context.Context,
	userID int,
	req *models.TBankConnectRequest,
) (*models.TBankConnectionStatusResponse, error) {
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

	defaultAccountID := strings.TrimSpace(req.DefaultAccountID)
	if defaultAccountID == "" && len(accounts) > 0 {
		defaultAccountID = accounts[0].ID
	}
	if defaultAccountID != "" && !containsAccount(accounts, defaultAccountID) {
		return nil, errors.New("default account is not available for this token")
	}

	if err := s.userSettingsRepo.UpsertSettings(userID, map[string]string{
		tbankSettingToken:            token,
		tbankSettingEnvironment:      environment,
		tbankSettingDefaultAccountID: defaultAccountID,
	}); err != nil {
		return nil, err
	}

	_ = s.auditService.LogUserAction(
		userID,
		models.ActionTBankConnected,
		userID,
		map[string]interface{}{
			"environment":        environment,
			"default_account_id": defaultAccountID,
			"accounts_count":     len(accounts),
		},
	)

	return &models.TBankConnectionStatusResponse{
		Connected:        true,
		Environment:      environment,
		TokenMasked:      maskToken(token),
		DefaultAccountID: defaultAccountID,
		Accounts:         accounts,
	}, nil
}

func (s *TBankService) Disconnect(userID int) error {
	if err := s.userSettingsRepo.UpsertSettings(userID, map[string]string{
		tbankSettingToken:            "",
		tbankSettingEnvironment:      "",
		tbankSettingDefaultAccountID: "",
	}); err != nil {
		return err
	}

	_ = s.auditService.LogUserAction(
		userID,
		models.ActionTBankDisconnected,
		userID,
		map[string]interface{}{},
	)
	return nil
}

func (s *TBankService) CreateTestBuyOrder(
	ctx context.Context,
	userID int,
	req *models.TBankTestBuyRequest,
) (*models.TBankTestBuyResponse, error) {
	if req == nil {
		return nil, errors.New("request is required")
	}

	instrumentID := strings.TrimSpace(req.InstrumentID)
	if instrumentID == "" {
		return nil, errors.New("instrument_id is required")
	}

	settings, err := s.userSettingsRepo.GetSettings(userID)
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
		if len(accounts) > 0 {
			accountID = accounts[0].ID
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

	resp := &models.TBankTestBuyResponse{
		Environment:           environment,
		AccountID:             accountID,
		InstrumentID:          instrumentID,
		Quantity:              req.Quantity,
		OrderID:               orderResp.GetOrderId(),
		ExecutionReportStatus: orderResp.GetExecutionReportStatus().String(),
		Response:              protoToMap(orderResp),
	}

	_ = s.auditService.LogUserAction(
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

func (s *TBankService) GetAccounts(
	ctx context.Context,
	environment string,
	token string,
) ([]models.TBankAccount, error) {
	var accounts []models.TBankAccount
	if err := s.withConnection(ctx, environment, token, func(callCtx context.Context, conn *grpc.ClientConn) error {
		client := pb.NewUsersServiceClient(conn)
		resp, callErr := client.GetAccounts(callCtx, &pb.GetAccountsRequest{})
		if callErr != nil {
			return callErr
		}

		accounts = make([]models.TBankAccount, 0, len(resp.GetAccounts()))
		for _, account := range resp.GetAccounts() {
			accounts = append(accounts, models.TBankAccount{
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
