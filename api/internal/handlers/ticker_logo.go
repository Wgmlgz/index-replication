package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
)

var tickerLogoPattern = regexp.MustCompile(`^[A-Z0-9._-]{1,24}$`)

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
	if isin == "" {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "Logo not found"})
		return
	}

	c.JSON(http.StatusOK, dto.TickerLogoResolveResponse{
		Ticker:  ticker,
		ISIN:    isin,
		LogoURL: fmt.Sprintf("%s/%sx160.png", tickerLogoCDNBase, url.PathEscape(isin)),
		Source:  "moex+tbank-invest-brands",
	})
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
