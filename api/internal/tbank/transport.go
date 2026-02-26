package tbank

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	"server/internal/api/dto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func (s *Service) withConnection(
	parentCtx context.Context,
	environment string,
	token string,
	call func(context.Context, *grpc.ClientConn) error,
) error {
	endpoint, err := s.endpointByEnvironment(environment)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(parentCtx, 15*time.Second)
	defer cancel()

	tlsConfig, err := s.buildTBankTLSConfig(endpoint)
	if err != nil {
		return err
	}

	conn, err := grpc.DialContext(
		ctx,
		endpoint,
		grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)),
		grpc.WithBlock(),
	)
	if err != nil {
		return fmt.Errorf("failed to connect to T-Bank gRPC endpoint: %w", err)
	}
	defer conn.Close()

	callCtx := metadata.AppendToOutgoingContext(
		ctx,
		"authorization", "Bearer "+token,
		"x-app-name", tbankAppName,
	)

	if err := call(callCtx, conn); err != nil {
		return normalizeTBankError(err)
	}
	return nil
}

func (s *Service) buildTBankTLSConfig(endpoint string) (*tls.Config, error) {
	host := endpoint
	if parsedHost, _, err := net.SplitHostPort(endpoint); err == nil {
		host = parsedHost
	}

	config := &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	}

	caPath := strings.TrimSpace(s.cfg.TBankCACertFile)
	if caPath == "" {
		return config, nil
	}

	certData, err := os.ReadFile(caPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read TBANK_CA_CERT_FILE (%s): %w", caPath, err)
	}

	pool, err := x509.SystemCertPool()
	if err != nil || pool == nil {
		pool = x509.NewCertPool()
	}
	if ok := pool.AppendCertsFromPEM(certData); !ok {
		return nil, fmt.Errorf("failed to parse PEM certificate(s) from TBANK_CA_CERT_FILE (%s)", caPath)
	}

	config.RootCAs = pool
	return config, nil
}

func (s *Service) endpointByEnvironment(environment string) (string, error) {
	switch normalizeTBankEnvironment(environment) {
	case dto.TBankEnvironmentSandbox:
		return s.cfg.TBankInvestSandboxGrpcEndpoint, nil
	case dto.TBankEnvironmentProduction:
		return s.cfg.TBankInvestGrpcEndpoint, nil
	default:
		return "", ErrTBankInvalidEnv
	}
}

func normalizeTBankEnvironment(environment string) string {
	switch strings.ToLower(strings.TrimSpace(environment)) {
	case dto.TBankEnvironmentProduction:
		return dto.TBankEnvironmentProduction
	default:
		return dto.TBankEnvironmentSandbox
	}
}

func normalizeTBankError(err error) error {
	if err == nil {
		return nil
	}
	st, ok := status.FromError(err)
	if !ok {
		return err
	}

	msg := strings.TrimSpace(st.Message())
	if msg == "" {
		msg = "T-Bank request failed"
	}
	if st.Code() == codes.InvalidArgument && msg == "30034" {
		return fmt.Errorf("sandbox account has insufficient funds (30034); top up balance and retry")
	}
	if st.Code() == codes.Unauthenticated || st.Code() == codes.PermissionDenied {
		return fmt.Errorf("%w: %s", ErrTBankAuthFailed, msg)
	}
	return fmt.Errorf("T-Bank API error (%s): %s", st.Code().String(), msg)
}

func toTimePtr(ts *timestamppb.Timestamp) *time.Time {
	if ts == nil {
		return nil
	}
	t := ts.AsTime().UTC()
	return &t
}

func maskToken(token string) string {
	token = strings.TrimSpace(token)
	if token == "" {
		return ""
	}
	if len(token) <= 8 {
		return strings.Repeat("*", len(token))
	}
	return token[:4] + strings.Repeat("*", len(token)-8) + token[len(token)-4:]
}

func containsAccount(accounts []dto.TBankAccount, accountID string) bool {
	for _, account := range accounts {
		if account.ID == accountID {
			return true
		}
	}
	return false
}

func selectDefaultAccountID(accounts []dto.TBankAccount) string {
	if len(accounts) == 0 {
		return ""
	}

	for _, account := range accounts {
		if strings.EqualFold(account.Status, "ACCOUNT_STATUS_OPEN") && strings.TrimSpace(account.ID) != "" {
			return account.ID
		}
	}

	for _, account := range accounts {
		if strings.TrimSpace(account.ID) != "" {
			return account.ID
		}
	}

	return ""
}

func protoToMap(msg proto.Message) map[string]interface{} {
	if msg == nil {
		return nil
	}
	raw, err := protojson.MarshalOptions{
		UseProtoNames:   true,
		EmitUnpopulated: false,
	}.Marshal(msg)
	if err != nil {
		return nil
	}
	var result map[string]interface{}
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil
	}
	return result
}
