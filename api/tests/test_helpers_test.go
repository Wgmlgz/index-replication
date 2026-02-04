package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	gormadapter "github.com/casbin/gorm-adapter/v3"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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
}

func newTestServer(t *testing.T) *testServer {
	t.Helper()
	gin.SetMode(gin.TestMode)

	logs := captureLogs(t)

	db, cleanup := testutil.NewTestDB(t)
	gormadapter.TurnOffAutoMigrate(db)

	chdirToModuleRoot(t)

	repoRegistry := repository.NewRepositoryRegistry(db)
	auditService := services.NewAuditService(db)
	cfg := &config.Config{
		SessionSecret: "test_secret",
	}

	router := routes.SetupRouter(db, cfg, repoRegistry, auditService)

	t.Cleanup(func() {
		if t.Failed() {
			logs.dump()
		}
	})

	return &testServer{
		router:  router,
		db:      db,
		cleanup: cleanup,
	}
}

func seedAdminUser(t *testing.T, ts *testServer, username, password string) {
	t.Helper()
	insertUser(t, ts, username, password, "Admin Test", 2)
}

func insertUser(t *testing.T, ts *testServer, username, password, fullName string, roleID int) {
	t.Helper()
	if fullName == "" {
		fullName = "Test User"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	result := ts.db.Exec(
		"INSERT INTO users (username, password_hash, full_name, role_id, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
		username,
		string(hash),
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

func login(t *testing.T, router *gin.Engine, username, password string) *http.Cookie {
	t.Helper()
	resp := doRequest(t, router, http.MethodPost, "/api/login", map[string]interface{}{
		"username": username,
		"password": password,
	}, nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", resp.Code, resp.Body.String())
	}
	return sessionCookieFromResponse(t, resp.Result())
}

func doRequest(t *testing.T, router *gin.Engine, method, path string, body interface{}, cookie *http.Cookie) *httptest.ResponseRecorder {
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
	if cookie != nil {
		req.AddCookie(cookie)
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

func findUserIDByUsername(t *testing.T, router *gin.Engine, cookie *http.Cookie, username string) int {
	t.Helper()

	resp := doRequest(t, router, http.MethodGet, "/api/users?search="+username, nil, cookie)
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

func sessionCookieFromResponse(t *testing.T, resp *http.Response) *http.Cookie {
	t.Helper()

	var sessionCookie *http.Cookie
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "auth_session" {
			sessionCookie = cookie
		}
	}
	if sessionCookie == nil {
		t.Fatalf("expected auth_session cookie to be set")
	}
	if sessionCookie.Value == "" || sessionCookie.MaxAge == -1 {
		t.Fatalf("expected a non-expired auth_session cookie")
	}
	return sessionCookie
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
