package auth

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"

	"server/internal/config"

	"github.com/coreos/go-oidc/v3/oidc"
)

var (
	ErrInvalidKeycloakToken = errors.New("invalid keycloak token")
	ErrMissingKeycloakSub   = errors.New("keycloak token missing sub claim")
)

type KeycloakClaims struct {
	Sub               string
	PreferredUsername string
	Name              string
}

type keycloakTokenClaims struct {
	Subject           string `json:"sub"`
	PreferredUsername string `json:"preferred_username"`
	Name              string `json:"name"`
}

type KeycloakAuthenticator struct {
	issuerURL         string
	clientID          string
	skipIssuerCheck   bool
	skipClientIDCheck bool
	initTimeout       time.Duration

	mu       sync.RWMutex
	verifier *oidc.IDTokenVerifier
}

func NewKeycloakAuthenticator(cfg *config.Config) *KeycloakAuthenticator {
	return &KeycloakAuthenticator{
		issuerURL:         strings.TrimSpace(cfg.KeycloakIssuerURL),
		clientID:          strings.TrimSpace(cfg.KeycloakClientID),
		skipIssuerCheck:   cfg.KeycloakSkipIssuerCheck,
		skipClientIDCheck: cfg.KeycloakSkipClientIDCheck,
		initTimeout:       5 * time.Second,
	}
}

func (a *KeycloakAuthenticator) Enabled() bool {
	return a != nil && a.issuerURL != ""
}

func (a *KeycloakAuthenticator) VerifyToken(ctx context.Context, rawToken string) (*KeycloakClaims, error) {
	if !a.Enabled() {
		return nil, fmt.Errorf("keycloak issuer url is required")
	}

	token := strings.TrimSpace(rawToken)
	if token == "" {
		return nil, fmt.Errorf("%w: empty token", ErrInvalidKeycloakToken)
	}

	verifier, err := a.getVerifier(ctx)
	if err != nil {
		return nil, err
	}

	verifiedToken, err := verifier.Verify(ctx, token)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidKeycloakToken, err)
	}

	var claims keycloakTokenClaims
	if err := verifiedToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("%w: failed to read claims", ErrInvalidKeycloakToken)
	}
	if strings.TrimSpace(claims.Subject) == "" {
		return nil, ErrMissingKeycloakSub
	}

	return &KeycloakClaims{
		Sub:               strings.TrimSpace(claims.Subject),
		PreferredUsername: strings.TrimSpace(claims.PreferredUsername),
		Name:              strings.TrimSpace(claims.Name),
	}, nil
}

func (a *KeycloakAuthenticator) getVerifier(ctx context.Context) (*oidc.IDTokenVerifier, error) {
	a.mu.RLock()
	if a.verifier != nil {
		verifier := a.verifier
		a.mu.RUnlock()
		return verifier, nil
	}
	a.mu.RUnlock()

	a.mu.Lock()
	defer a.mu.Unlock()
	if a.verifier != nil {
		return a.verifier, nil
	}

	initCtx := ctx
	cancel := func() {}
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		initCtx, cancel = context.WithTimeout(ctx, a.initTimeout)
	}
	defer cancel()

	provider, err := oidc.NewProvider(initCtx, a.issuerURL)
	if err != nil {
		fallbackIssuerURL, ok := withAuthRelativePathIssuerFallback(a.issuerURL)
		if !ok {
			return nil, fmt.Errorf("failed to load keycloak provider: %w", err)
		}

		provider, err = oidc.NewProvider(initCtx, fallbackIssuerURL)
		if err != nil {
			return nil, fmt.Errorf("failed to load keycloak provider: %w", err)
		}
		a.issuerURL = fallbackIssuerURL
	}

	skipClientIDCheck := a.skipClientIDCheck || a.clientID == ""
	a.verifier = provider.Verifier(&oidc.Config{
		ClientID:          a.clientID,
		SkipIssuerCheck:   a.skipIssuerCheck,
		SkipClientIDCheck: skipClientIDCheck,
	})

	return a.verifier, nil
}

func withAuthRelativePathIssuerFallback(issuerURL string) (string, bool) {
	trimmed := strings.TrimSpace(issuerURL)
	if trimmed == "" {
		return "", false
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", false
	}

	path := strings.TrimSpace(parsed.Path)
	if path == "" || strings.HasPrefix(path, "/auth/") || path == "/auth" {
		return "", false
	}

	if strings.HasPrefix(path, "/realms/") {
		parsed.Path = "/auth" + path
		return strings.TrimRight(parsed.String(), "/"), true
	}

	if strings.Contains(path, "/realms/") {
		parsed.Path = strings.Replace(path, "/realms/", "/auth/realms/", 1)
		return strings.TrimRight(parsed.String(), "/"), true
	}

	return "", false
}
