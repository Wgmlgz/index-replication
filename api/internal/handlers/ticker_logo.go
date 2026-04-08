package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"server/internal/api/dto"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	moexSecuritiesSearchURL = "https://iss.moex.com/iss/securities.json"
	tickerLogoCDNBase       = "https://invest-brands.cdn-tinkoff.ru"
	tbankStockPageURLFormat = "https://www.tbank.ru/invest/stocks/%s/"
	maxLogoPageBytes        = 10 << 20
)

var tickerLogoPattern = regexp.MustCompile(`^[A-Z0-9._-]{1,24}$`)
var tickerLogoNamePattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,64}$`)

type TickerLogoHandler struct {
	client *http.Client
}

type moexSecuritiesTable struct {
	Columns []string        `json:"columns"`
	Data    [][]interface{} `json:"data"`
}

type moexSecuritiesResponse struct {
	Securities moexSecuritiesTable `json:"securities"`
}

func NewTickerLogoHandler() *TickerLogoHandler {
	return &TickerLogoHandler{
		client: &http.Client{Timeout: 6 * time.Second},
	}
}

// ResolveTickerLogo godoc
//
//	@Summary		Resolve ticker logo URL
//	@Description	Resolves a public logo URL by ticker symbol
//	@Tags			branding
//	@Produce		json
//	@Param			ticker	query		string	true	"Ticker symbol"
//	@Success		200		{object}	dto.TickerLogoResolveResponse
//	@Failure		400		{object}	dto.ErrorResponse
//	@Failure		404		{object}	dto.ErrorResponse
//	@Failure		502		{object}	dto.ErrorResponse
//	@Router			/tickers/logo [get]
func (h *TickerLogoHandler) ResolveTickerLogo(c *gin.Context) {
	ticker := strings.ToUpper(strings.TrimSpace(c.Query("ticker")))
	if ticker == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Missing ticker"})
		return
	}
	if !tickerLogoPattern.MatchString(ticker) {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid ticker"})
		return
	}

	isin, err := h.resolveISIN(c.Request.Context(), ticker)
	if err != nil {
		c.JSON(http.StatusBadGateway, dto.ErrorResponse{Error: "Failed to resolve ticker logo"})
		return
	}

	candidateKeys := tickerLogoCandidates(isin)
	var firstCheckErr error
	tryCandidate := func(candidateKey string) bool {
		if strings.TrimSpace(candidateKey) == "" {
			return false
		}
		logoURL := fmt.Sprintf("%s/%sx160.png", tickerLogoCDNBase, url.PathEscape(candidateKey))
		logoExists, checkErr := h.logoExists(c.Request.Context(), logoURL)
		if checkErr != nil {
			if firstCheckErr == nil {
				firstCheckErr = checkErr
			}
			return false
		}
		if !logoExists {
			return false
		}

		c.JSON(http.StatusOK, dto.TickerLogoResolveResponse{
			Ticker:  ticker,
			ISIN:    candidateKey,
			LogoURL: logoURL,
			Source:  "moex+tbank-invest-brands",
		})
		return true
	}

	for _, candidateKey := range candidateKeys {
		if tryCandidate(candidateKey) {
			return
		}
	}

	// Fallback is invoked only when the primary key cannot be used.
	fallbackKey, _ := h.resolveTbankLogoKeyByTicker(c.Request.Context(), ticker)
	fallbackKey = strings.TrimSpace(fallbackKey)
	if fallbackKey != "" {
		seen := false
		for _, existing := range candidateKeys {
			if strings.EqualFold(strings.TrimSpace(existing), fallbackKey) {
				seen = true
				break
			}
		}
		if !seen && tryCandidate(fallbackKey) {
			return
		}
	}

	if firstCheckErr != nil {
		c.JSON(http.StatusBadGateway, dto.ErrorResponse{Error: "Failed to resolve ticker logo"})
		return
	}
	c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "Logo not found"})
}

func (h *TickerLogoHandler) resolveISIN(ctx context.Context, ticker string) (string, error) {
	params := url.Values{
		"q":                  []string{ticker},
		"iss.meta":           []string{"off"},
		"iss.only":           []string{"securities"},
		"securities.columns": []string{"secid,isin"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, moexSecuritiesSearchURL+"?"+params.Encode(), nil)
	if err != nil {
		return "", err
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return "", nil
		}
		return "", errors.New("upstream non-200")
	}

	var payload moexSecuritiesResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", err
	}

	isin := pickTickerISIN(payload.Securities, ticker)
	if isin == "" {
		return "", nil
	}
	return isin, nil
}

func (h *TickerLogoHandler) logoExists(ctx context.Context, logoURL string) (bool, error) {
	headReq, err := http.NewRequestWithContext(ctx, http.MethodHead, logoURL, nil)
	if err != nil {
		return false, err
	}

	headResp, err := h.client.Do(headReq)
	if err != nil {
		return false, err
	}
	headResp.Body.Close()

	if headResp.StatusCode == http.StatusMethodNotAllowed {
		getReq, err := http.NewRequestWithContext(ctx, http.MethodGet, logoURL, nil)
		if err != nil {
			return false, err
		}
		getReq.Header.Set("Range", "bytes=0-0")

		getResp, err := h.client.Do(getReq)
		if err != nil {
			return false, err
		}
		getResp.Body.Close()

		if getResp.StatusCode >= 500 {
			return false, errors.New("logo upstream non-200")
		}
		return getResp.StatusCode >= 200 && getResp.StatusCode < 300, nil
	}

	if headResp.StatusCode >= 500 {
		return false, errors.New("logo upstream non-200")
	}
	return headResp.StatusCode >= 200 && headResp.StatusCode < 300, nil
}

func pickTickerISIN(table moexSecuritiesTable, ticker string) string {
	if len(table.Columns) == 0 || len(table.Data) == 0 {
		return ""
	}

	secidIdx := -1
	isinIdx := -1
	for i, col := range table.Columns {
		switch strings.ToLower(strings.TrimSpace(col)) {
		case "secid":
			secidIdx = i
		case "isin":
			isinIdx = i
		}
	}
	if secidIdx < 0 || isinIdx < 0 {
		return ""
	}

	for _, row := range table.Data {
		if secidIdx >= len(row) || isinIdx >= len(row) {
			continue
		}

		secid, _ := row[secidIdx].(string)
		isin, _ := row[isinIdx].(string)
		if strings.EqualFold(strings.TrimSpace(secid), ticker) {
			return strings.TrimSpace(isin)
		}
	}
	return ""
}

func tickerLogoCandidates(primaryISIN string) []string {
	candidates := make([]string, 0, 1)
	seen := make(map[string]struct{})
	add := func(value string) {
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			return
		}
		if _, exists := seen[normalized]; exists {
			return
		}
		seen[normalized] = struct{}{}
		candidates = append(candidates, normalized)
	}

	add(primaryISIN)
	return candidates
}

func appendUniqueTickerLogoKey(values []string, value string) []string {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return values
	}
	for _, existing := range values {
		if strings.EqualFold(strings.TrimSpace(existing), normalized) {
			return values
		}
	}
	return append(values, normalized)
}

func (h *TickerLogoHandler) resolveTbankLogoKeyByTicker(ctx context.Context, ticker string) (string, error) {
	normalizedTicker := strings.ToUpper(strings.TrimSpace(ticker))
	if normalizedTicker == "" {
		return "", nil
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		fmt.Sprintf(tbankStockPageURLFormat, url.PathEscape(normalizedTicker)),
		nil,
	)
	if err != nil {
		return "", err
	}

	resp, err := h.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "", nil
	}
	if resp.StatusCode != http.StatusOK {
		return "", errors.New("tbank stock page upstream non-200")
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, maxLogoPageBytes))
	if err != nil {
		return "", err
	}
	return pickTbankLogoKeyFromHTML(string(bodyBytes), normalizedTicker), nil
}

func pickTbankLogoKeyFromHTML(html string, ticker string) string {
	normalizedTicker := strings.ToUpper(strings.TrimSpace(ticker))
	if normalizedTicker == "" || html == "" {
		return ""
	}

	pattern := fmt.Sprintf(`"%s":\{[^}]*"logoName":"([^"]+)"`, regexp.QuoteMeta(normalizedTicker))
	re := regexp.MustCompile(pattern)
	match := re.FindStringSubmatch(html)
	if len(match) < 2 {
		return ""
	}

	logoName := strings.TrimSpace(match[1])
	if dotIdx := strings.LastIndexByte(logoName, '.'); dotIdx > 0 {
		ext := strings.ToLower(logoName[dotIdx:])
		if ext == ".png" || ext == ".svg" || ext == ".jpg" || ext == ".jpeg" || ext == ".webp" {
			logoName = logoName[:dotIdx]
		}
	}
	logoName = strings.TrimSpace(logoName)
	if !tickerLogoNamePattern.MatchString(logoName) {
		return ""
	}
	return logoName
}
