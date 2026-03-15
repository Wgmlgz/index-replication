package tests

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	gormadapter "github.com/casbin/gorm-adapter/v3"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"

	"server/internal/config"
	"server/internal/repository"
	"server/internal/routes"
	"server/internal/services"
	"server/internal/testutil"
)

type testServer struct {
	router  *gin.Engine
	db      *gorm.DB
	cleanup func()
	oidc    *testOIDCServer
}

type testOIDCServer struct {
	server     *httptest.Server
	issuerURL  string
	jwksURL    string
	privateKey *rsa.PrivateKey
	keyID      string
}

func newTestServer(t *testing.T) *testServer {
	return newTestServerWithConfig(t, nil)
}

func newTestServerWithConfig(t *testing.T, cfg *config.Config) *testServer {
	t.Helper()
	gin.SetMode(gin.TestMode)

	logs := captureLogs(t)
	oidc := newTestOIDCServer(t)
	t.Cleanup(func() {
		oidc.close()
	})

	db, cleanup := testutil.NewTestDB(t)
	gormadapter.TurnOffAutoMigrate(db)

	chdirToModuleRoot(t)

	repoRegistry := repository.NewRepositoryRegistry(db)
	auditService := services.NewAuditService(db)
	if cfg == nil {
		cfg = &config.Config{}
	}
	if strings.TrimSpace(cfg.KeycloakIssuerURL) == "" {
		cfg.KeycloakIssuerURL = oidc.issuerURL
	}
	cfg.KeycloakSkipIssuerCheck = true
	cfg.KeycloakSkipClientIDCheck = true

	router := routes.SetupRouter(db, cfg, repoRegistry, auditService)

	t.Cleanup(func() {
		if t.Failed() {
			logs.dump()
		}
	})

	return &testServer{
		router: router,
		db:     db,
		oidc:   oidc,
		cleanup: func() {
			cleanup()
		},
	}
}

func newTestOIDCServer(t *testing.T) *testOIDCServer {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate oidc private key: %v", err)
	}

	oidc := &testOIDCServer{
		privateKey: privateKey,
		keyID:      "test-key-1",
	}

	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	oidc.server = server
	oidc.issuerURL = server.URL
	oidc.jwksURL = server.URL + "/keys"

	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"issuer":   oidc.issuerURL,
			"jwks_uri": oidc.jwksURL,
		})
	})

	mux.HandleFunc("/keys", func(w http.ResponseWriter, r *http.Request) {
		pubKey, ok := oidc.privateKey.Public().(*rsa.PublicKey)
		if !ok {
			http.Error(w, "invalid key", http.StatusInternalServerError)
			return
		}
		n := base64.RawURLEncoding.EncodeToString(pubKey.N.Bytes())
		e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pubKey.E)).Bytes())

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"keys": []map[string]string{
				{
					"kty": "RSA",
					"use": "sig",
					"alg": "RS256",
					"kid": oidc.keyID,
					"n":   n,
					"e":   e,
				},
			},
		})
	})

	return oidc
}

func (s *testOIDCServer) close() {
	if s != nil && s.server != nil {
		s.server.Close()
	}
}

func (s *testOIDCServer) issueToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	if s == nil || s.privateKey == nil {
		t.Fatalf("oidc server is not initialized")
	}

	now := time.Now().UTC()
	if _, ok := claims["iss"]; !ok {
		claims["iss"] = s.issuerURL
	}
	if _, ok := claims["iat"]; !ok {
		claims["iat"] = now.Unix()
	}
	if _, ok := claims["nbf"]; !ok {
		claims["nbf"] = now.Add(-1 * time.Minute).Unix()
	}
	if _, ok := claims["exp"]; !ok {
		claims["exp"] = now.Add(1 * time.Hour).Unix()
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = s.keyID
	signed, err := token.SignedString(s.privateKey)
	if err != nil {
		t.Fatalf("failed to sign oidc token: %v", err)
	}
	return signed
}

func seedAdminUser(t *testing.T, ts *testServer, username, _ string) {
	t.Helper()
	insertUser(t, ts, username, "", "Admin Test", 2)
}

func insertUser(t *testing.T, ts *testServer, username, _ string, fullName string, roleID int) {
	t.Helper()
	if fullName == "" {
		fullName = "Test User"
	}

	result := ts.db.Exec(
		"INSERT INTO users (username, full_name, role_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
		username,
		fullName,
		roleID,
	)
	if result.Error != nil {
		t.Fatalf("failed to insert user: %v", result.Error)
	}
}

func userIDByUsername(t *testing.T, ts *testServer, username string) int {
	t.Helper()

	var id int
	if err := ts.db.Raw("SELECT id FROM users WHERE username = ?", username).Scan(&id).Error; err != nil {
		t.Fatalf("failed to fetch user id: %v", err)
	}
	if id == 0 {
		t.Fatalf("user id not found for %s", username)
	}
	return id
}

func insertAuditLog(t *testing.T, ts *testServer, performedBy int, action, entityType string, entityID *int, details string, tsTime time.Time) int {
	t.Helper()

	result := ts.db.Exec(
		"INSERT INTO audit_logs (performed_by, action, entity_type, entity_id, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
		performedBy,
		action,
		entityType,
		entityID,
		details,
		tsTime,
	)
	if result.Error != nil {
		t.Fatalf("failed to insert audit log: %v", result.Error)
	}

	var id int
	if err := ts.db.Raw("SELECT last_insert_rowid()").Scan(&id).Error; err != nil {
		t.Fatalf("failed to read audit log id: %v", err)
	}
	return id
}

func login(t *testing.T, ts *testServer, username, _ string) string {
	t.Helper()

	var row struct {
		ID          int
		KeycloakSub *string
		FullName    string
	}

	if err := ts.db.Raw(
		"SELECT id, keycloak_sub, full_name FROM users WHERE username = ?",
		username,
	).Scan(&row).Error; err != nil {
		t.Fatalf("failed to fetch user for login: %v", err)
	}
	if row.ID == 0 {
		t.Fatalf("user not found for login: %s", username)
	}

	sub := ""
	if row.KeycloakSub != nil {
		sub = strings.TrimSpace(*row.KeycloakSub)
	}
	if sub == "" {
		sub = "test-sub-" + username
		if err := ts.db.Exec("UPDATE users SET keycloak_sub = ? WHERE id = ?", sub, row.ID).Error; err != nil {
			t.Fatalf("failed to set keycloak_sub: %v", err)
		}
	}

	return ts.oidc.issueToken(t, jwt.MapClaims{
		"sub":                sub,
		"preferred_username": username,
		"name":               row.FullName,
	})
}

func doRequest(t *testing.T, router *gin.Engine, method, path string, body interface{}, bearerToken string) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("failed to marshal request body: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if strings.TrimSpace(bearerToken) != "" {
		req.Header.Set("Authorization", "Bearer "+bearerToken)
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func decodeJSON(t *testing.T, rec *httptest.ResponseRecorder, v interface{}) {
	t.Helper()
	if err := json.NewDecoder(rec.Body).Decode(v); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}
}

func findUserIDByUsername(t *testing.T, router *gin.Engine, bearerToken string, username string) int {
	t.Helper()

	resp := doRequest(t, router, http.MethodGet, "/api/users?search="+username, nil, bearerToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("list users status = %d, body = %s", resp.Code, resp.Body.String())
	}

	var listResp userListResponse
	decodeJSON(t, resp, &listResp)
	for _, user := range listResp.Users {
		if user.Username == username {
			return user.ID
		}
	}

	return 0
}

func pathUser(id int) string {
	return "/api/users/" + strconv.Itoa(id)
}

func pathUserAction(id int, action string) string {
	return "/api/users/" + strconv.Itoa(id) + "/" + action
}

func itoa(v int) string {
	return strconv.Itoa(v)
}

func chdirToModuleRoot(t *testing.T) {
	t.Helper()

	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("failed to get working dir: %v", err)
	}

	for {
		if fileExists(filepath.Join(wd, "go.mod")) && fileExists(filepath.Join(wd, "internal", "config", "model.conf")) {
			if err := os.Chdir(wd); err != nil {
				t.Fatalf("failed to chdir: %v", err)
			}
			return
		}

		parent := filepath.Dir(wd)
		if parent == wd {
			break
		}
		wd = parent
	}

	t.Fatalf("could not locate module root with go.mod and internal/config/model.conf")
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

type logCapture struct {
	ginBuf *bytes.Buffer
	stdBuf *bytes.Buffer
}

func captureLogs(t *testing.T) *logCapture {
	t.Helper()

	ginBuf := &bytes.Buffer{}
	stdBuf := &bytes.Buffer{}

	originalGinWriter := gin.DefaultWriter
	originalGinErrWriter := gin.DefaultErrorWriter
	originalLogWriter := log.Writer()

	gin.DefaultWriter = ginBuf
	gin.DefaultErrorWriter = ginBuf
	log.SetOutput(stdBuf)

	t.Cleanup(func() {
		gin.DefaultWriter = originalGinWriter
		gin.DefaultErrorWriter = originalGinErrWriter
		log.SetOutput(originalLogWriter)
	})

	return &logCapture{
		ginBuf: ginBuf,
		stdBuf: stdBuf,
	}
}

func (c *logCapture) dump() {
	_, _ = fmt.Fprintln(os.Stdout, "\n-- captured gin logs --")
	_, _ = io.Copy(os.Stdout, c.ginBuf)
	_, _ = fmt.Fprintln(os.Stdout, "\n-- captured app logs --")
	_, _ = io.Copy(os.Stdout, c.stdBuf)
	_, _ = fmt.Fprintln(os.Stdout)
}
