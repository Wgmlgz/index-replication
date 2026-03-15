package tests

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"server/internal/api/dto"
	"server/internal/config"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/protobuf/types/known/timestamppb"
	pb "opensource.tbank.ru/invest/invest-go/proto"
)

func TestPortfolioHistory_UsesMoexCacheAndReusesPersistedRows(t *testing.T) {
	t.Run("virtual provider", func(t *testing.T) {
		moexServer, moexCalls := newMoexHistoryMockServer(t)
		defer moexServer.Close()

		ts := newTestServerWithConfig(t, &config.Config{
			MoexBaseURL: moexServer.URL,
		})
		defer ts.cleanup()

		seedAdminUser(t, ts, "admin_virtual_m2m", "password123")
		token := login(t, ts, "admin_virtual_m2m", "password123")
		profile := createVirtualPortfolioProfile(t, ts, token, "Virtual M2M")

		deposit := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(profile.ID)+"/actions/deposit_cash", map[string]interface{}{
			"payload": map[string]interface{}{
				"amount":      10000,
				"currency":    "RUB",
				"executed_at": "2026-01-01",
			},
		}, token)
		if deposit.Code != http.StatusOK {
			t.Fatalf("deposit status=%d body=%s", deposit.Code, deposit.Body.String())
		}
		buy := doRequest(t, ts.router, http.MethodPost, "/api/me/portfolios/"+itoa(profile.ID)+"/actions/buy", map[string]interface{}{
			"payload": map[string]interface{}{
				"ticker":      "SBER",
				"quantity":    10,
				"price":       100,
				"currency":    "RUB",
				"executed_at": "2026-01-02",
			},
		}, token)
		if buy.Code != http.StatusOK {
			t.Fatalf("buy status=%d body=%s", buy.Code, buy.Body.String())
		}

		path := "/api/me/portfolios/" + itoa(profile.ID) + "/history?from=2026-01-02&till=2026-01-03&intervalDays=1"
		first := doRequest(t, ts.router, http.MethodGet, path, nil, token)
		if first.Code != http.StatusOK {
			t.Fatalf("first history status=%d body=%s", first.Code, first.Body.String())
		}
		var history []portfolioHistoryPointResponse
		decodeJSON(t, first, &history)
		if len(history) != 2 {
			t.Fatalf("expected 2 history points, got %d", len(history))
		}
		if history[0].TotalAmountPortfolio == history[1].TotalAmountPortfolio {
			t.Fatalf("expected mark-to-market change on no-trade day, got %+v", history)
		}

		if moexCalls.Load() == 0 {
			t.Fatalf("expected upstream MOEX call on first request")
		}
		var persisted int64
		if err := ts.db.Raw(
			"SELECT COUNT(*) FROM moex_security_history_daily WHERE secid = ? AND board = ?",
			"SBER", "TQBR",
		).Scan(&persisted).Error; err != nil {
			t.Fatalf("count persisted prices: %v", err)
		}
		if persisted == 0 {
			t.Fatalf("expected persisted moex_security_history_daily rows")
		}

		callCount := moexCalls.Load()
		second := doRequest(t, ts.router, http.MethodGet, path, nil, token)
		if second.Code != http.StatusOK {
			t.Fatalf("second history status=%d body=%s", second.Code, second.Body.String())
		}
		if moexCalls.Load() != callCount {
			t.Fatalf("expected second request to reuse DB cache without extra fetch")
		}
	})

	t.Run("tbank provider", func(t *testing.T) {
		moexServer, moexCalls := newMoexHistoryMockServer(t)
		defer moexServer.Close()

		endpoint, caPath, stopGrpc := startFakeTBankGRPCServer(t)
		defer stopGrpc()

		ts := newTestServerWithConfig(t, &config.Config{
			MoexBaseURL:                    moexServer.URL,
			TBankInvestGrpcEndpoint:        endpoint,
			TBankInvestSandboxGrpcEndpoint: endpoint,
			TBankCACertFile:                caPath,
		})
		defer ts.cleanup()

		seedAdminUser(t, ts, "admin_tbank_m2m", "password123")
		token := login(t, ts, "admin_tbank_m2m", "password123")
		userID := userIDByUsername(t, ts, "admin_tbank_m2m")
		seedTBankSettings(t, ts, userID, "fake-token", dto.TBankEnvironmentSandbox, "acc-test")

		profile := createPortfolioProfile(
			t,
			ts,
			token,
			"tbank",
			"TBank M2M",
			map[string]interface{}{"account_id": "acc-test"},
		)

		path := "/api/me/portfolios/" + itoa(profile.ID) + "/history?from=2026-01-02&till=2026-01-03&intervalDays=1"
		first := doRequest(t, ts.router, http.MethodGet, path, nil, token)
		if first.Code != http.StatusOK {
			t.Fatalf("first history status=%d body=%s", first.Code, first.Body.String())
		}
		var history []portfolioHistoryPointResponse
		decodeJSON(t, first, &history)
		if len(history) != 2 {
			t.Fatalf("expected 2 history points, got %d", len(history))
		}
		if history[0].TotalAmountPortfolio == history[1].TotalAmountPortfolio {
			t.Fatalf("expected mark-to-market change on no-trade day, got %+v", history)
		}

		if moexCalls.Load() == 0 {
			t.Fatalf("expected upstream MOEX call on first request")
		}
		var persisted int64
		if err := ts.db.Raw(
			"SELECT COUNT(*) FROM moex_security_history_daily WHERE secid = ? AND board = ?",
			"SBER", "TQBR",
		).Scan(&persisted).Error; err != nil {
			t.Fatalf("count persisted prices: %v", err)
		}
		if persisted == 0 {
			t.Fatalf("expected persisted moex_security_history_daily rows")
		}

		callCount := moexCalls.Load()
		second := doRequest(t, ts.router, http.MethodGet, path, nil, token)
		if second.Code != http.StatusOK {
			t.Fatalf("second history status=%d body=%s", second.Code, second.Body.String())
		}
		if moexCalls.Load() != callCount {
			t.Fatalf("expected second request to reuse DB cache without extra fetch")
		}
	})
}

func seedTBankSettings(t *testing.T, ts *testServer, userID int, token, environment, accountID string) {
	t.Helper()
	settings := map[string]string{
		"integrations.tbank.token":              token,
		"integrations.tbank.environment":        environment,
		"integrations.tbank.default_account_id": accountID,
	}
	for key, value := range settings {
		if err := ts.db.Exec(
			`INSERT INTO user_settings(user_id, key, value, updated_at)
			 VALUES (?, ?, ?, CURRENT_TIMESTAMP)
			 ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
			userID,
			key,
			value,
		).Error; err != nil {
			t.Fatalf("seed setting %s: %v", key, err)
		}
	}
}

func newMoexHistoryMockServer(t *testing.T) (*httptest.Server, *atomic.Int32) {
	t.Helper()

	calls := &atomic.Int32{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/history/engines/stock/markets/shares/boards/TQBR/securities/SBER.json" {
			calls.Add(1)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
  "history": {
    "columns": ["TRADEDATE","CLOSE","OPEN","HIGH","LOW"],
    "data": [
      ["2026-01-02",100,99,101,98],
      ["2026-01-03",120,119,121,118]
    ]
  },
  "history.cursor": {
    "columns": ["INDEX","TOTAL","PAGESIZE"],
    "data": [[0,2,100]]
  }
}`))
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
  "history": {
    "columns": ["TRADEDATE","CLOSE","OPEN","HIGH","LOW"],
    "data": []
  },
  "history.cursor": {
    "columns": ["INDEX","TOTAL","PAGESIZE"],
    "data": [[0,0,100]]
  }
}`))
	}))
	return server, calls
}

type fakeUsersService struct {
	pb.UnimplementedUsersServiceServer
}

func (s *fakeUsersService) GetAccounts(context.Context, *pb.GetAccountsRequest) (*pb.GetAccountsResponse, error) {
	return &pb.GetAccountsResponse{
		Accounts: []*pb.Account{
			{
				Id:     "acc-test",
				Name:   "Sandbox",
				Type:   pb.AccountType_ACCOUNT_TYPE_TINKOFF,
				Status: pb.AccountStatus_ACCOUNT_STATUS_OPEN,
			},
		},
	}, nil
}

type fakeOperationsService struct {
	pb.UnimplementedOperationsServiceServer
}

func (s *fakeOperationsService) GetPortfolio(context.Context, *pb.PortfolioRequest) (*pb.PortfolioResponse, error) {
	return &pb.PortfolioResponse{
		TotalAmountPortfolio: &pb.MoneyValue{Currency: "RUB", Units: 1_000},
		Positions: []*pb.PortfolioPosition{
			{
				Ticker:         "SBER",
				InstrumentUid:  "UID1",
				InstrumentType: "share",
				Quantity:       &pb.Quotation{Units: 10},
				CurrentPrice:   &pb.MoneyValue{Currency: "RUB", Units: 100},
			},
		},
	}, nil
}

func (s *fakeOperationsService) GetPositions(context.Context, *pb.PositionsRequest) (*pb.PositionsResponse, error) {
	return &pb.PositionsResponse{
		Money: []*pb.MoneyValue{
			{Currency: "RUB", Units: 0},
		},
	}, nil
}

func (s *fakeOperationsService) GetWithdrawLimits(context.Context, *pb.WithdrawLimitsRequest) (*pb.WithdrawLimitsResponse, error) {
	return &pb.WithdrawLimitsResponse{
		Money: []*pb.MoneyValue{
			{Currency: "RUB", Units: 0},
		},
	}, nil
}

func (s *fakeOperationsService) GetOperationsByCursor(context.Context, *pb.GetOperationsByCursorRequest) (*pb.GetOperationsByCursorResponse, error) {
	state := pb.OperationState_OPERATION_STATE_EXECUTED
	return &pb.GetOperationsByCursorResponse{
		HasNext: false,
		Items: []*pb.OperationItem{
			{
				Id:            "op-buy-1",
				State:         state,
				Type:          pb.OperationType_OPERATION_TYPE_BUY,
				Date:          timestamppb.New(time.Date(2026, time.January, 2, 12, 0, 0, 0, time.UTC)),
				InstrumentUid: "UID1",
				QuantityDone:  10,
				Payment:       &pb.MoneyValue{Currency: "RUB", Units: -1000},
				Price:         &pb.MoneyValue{Currency: "RUB", Units: 100},
			},
		},
	}, nil
}

func startFakeTBankGRPCServer(t *testing.T) (string, string, func()) {
	t.Helper()

	caCertPEM, certPEM, keyPEM := generateTestCertificates(t)
	cert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		t.Fatalf("load test tls key pair: %v", err)
	}

	caPath := filepath.Join(t.TempDir(), "test-ca.pem")
	if err := os.WriteFile(caPath, caCertPEM, 0o600); err != nil {
		t.Fatalf("write test ca: %v", err)
	}

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen fake grpc: %v", err)
	}

	grpcServer := grpc.NewServer(grpc.Creds(credentials.NewTLS(&tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	})))
	pb.RegisterUsersServiceServer(grpcServer, &fakeUsersService{})
	pb.RegisterOperationsServiceServer(grpcServer, &fakeOperationsService{})

	go func() {
		_ = grpcServer.Serve(lis)
	}()

	return lis.Addr().String(), caPath, func() {
		grpcServer.Stop()
		_ = lis.Close()
	}
}

func generateTestCertificates(t *testing.T) ([]byte, []byte, []byte) {
	t.Helper()

	caKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate ca key: %v", err)
	}
	caTemplate := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "test-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		IsCA:                  true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		BasicConstraintsValid: true,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &caKey.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create ca cert: %v", err)
	}

	serverKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate server key: %v", err)
	}
	serverTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: "127.0.0.1"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
		DNSNames:     []string{"localhost"},
	}
	serverDER, err := x509.CreateCertificate(rand.Reader, serverTemplate, caTemplate, &serverKey.PublicKey, caKey)
	if err != nil {
		t.Fatalf("create server cert: %v", err)
	}

	caCertPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER})
	serverCertPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: serverDER})
	serverKeyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(serverKey)})
	return caCertPEM, serverCertPEM, serverKeyPEM
}
