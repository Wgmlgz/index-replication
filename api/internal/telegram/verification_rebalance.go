package telegram

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strconv"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/rebalance"

	"github.com/google/uuid"
)

func (s *VerificationService) RequestRebalanceExecutionConfirmation(
	ctx context.Context,
	req rebalance.AutoExecutionConfirmationRequest,
) error {
	if req.UserID <= 0 || req.PortfolioID <= 0 || req.RunID <= 0 {
		return errors.New("invalid rebalance confirmation request")
	}
	if s.telegramService == nil || !s.telegramService.Enabled() {
		return fmt.Errorf("%w: TELEGRAM_BOT_TOKEN is empty", ErrTelegramUnavailable)
	}

	_, chatID, _, err := s.readTelegramStatus(req.UserID)
	if err != nil {
		return err
	}
	if chatID == 0 {
		return ErrTelegramNotConnected
	}

	now := time.Now().UTC()
	expiresAt := now.Add(s.rebalanceChallengeTTL())
	detailsBytes, _ := json.Marshal(map[string]interface{}{
		"portfolio_id": req.PortfolioID,
		"run_id":       req.RunID,
		"as_of_date":   strings.TrimSpace(req.AsOfDate),
	})

	challenge := &models.VerificationChallenge{
		ID:         uuid.NewString(),
		UserID:     req.UserID,
		Purpose:    models.VerificationPurposeRebalanceExecution,
		Status:     models.VerificationStatusPending,
		RememberMe: false,
		Details:    string(detailsBytes),
		ExpiresAt:  expiresAt,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.verificationRepo.CreateChallenge(challenge); err != nil {
		return err
	}

	keyboard := map[string]interface{}{
		"inline_keyboard": [][]map[string]string{
			{
				{
					"text":          "Continue",
					"callback_data": callbackPrefixRebalanceApprove + challenge.ID,
				},
				{
					"text":          "Abort",
					"callback_data": callbackPrefixRebalanceDeny + challenge.ID,
				},
			},
		},
	}
	text := s.buildRebalanceConfirmationMessage(req, expiresAt)

	if _, err := s.telegramService.SendMessage(ctx, chatID, text, keyboard); err != nil {
		challenge.Status = models.VerificationStatusExpired
		challenge.UpdatedAt = time.Now().UTC()
		_ = s.verificationRepo.SaveChallenge(challenge)
		log.Printf(
			"verification: failed to send rebalance confirmation user_id=%d chat_id=%d run_id=%d err=%v",
			req.UserID,
			chatID,
			req.RunID,
			err,
		)
		return fmt.Errorf("failed to deliver telegram confirmation message: %w", err)
	}

	_ = s.auditLogger.LogUserAction(
		req.UserID,
		models.ActionRebalanceConfirmationSent,
		req.UserID,
		map[string]interface{}{
			"challenge_id": challenge.ID,
			"portfolio_id": req.PortfolioID,
			"run_id":       req.RunID,
			"expires_at":   challenge.ExpiresAt,
		},
	)
	return nil
}

func (s *VerificationService) executeApprovedRebalanceConfirmation(
	ctx context.Context,
	challenge *models.VerificationChallenge,
) error {
	if challenge == nil {
		return errors.New("rebalance challenge is nil")
	}
	if s.rebalanceExecutor == nil {
		return errors.New("rebalance executor is not configured")
	}

	var details struct {
		PortfolioID int `json:"portfolio_id"`
		RunID       int `json:"run_id"`
	}
	if err := json.Unmarshal([]byte(challenge.Details), &details); err != nil {
		return fmt.Errorf("decode rebalance challenge details: %w", err)
	}
	if details.PortfolioID <= 0 || details.RunID <= 0 {
		return errors.New("invalid rebalance challenge details")
	}

	_, err := s.rebalanceExecutor.ExecuteRun(
		ctx,
		challenge.UserID,
		details.PortfolioID,
		details.RunID,
	)
	return err
}

func (s *VerificationService) rebalanceChallengeTTL() time.Duration {
	return defaultRebalanceChallengeTTL
}

func (s *VerificationService) buildRebalanceConfirmationMessage(
	req rebalance.AutoExecutionConfirmationRequest,
	expiresAt time.Time,
) string {
	lines := []string{
		fmt.Sprintf("Rebalance draft #%d is ready.", req.RunID),
		fmt.Sprintf("Portfolio ID: %d", req.PortfolioID),
	}
	asOfDate := strings.TrimSpace(req.AsOfDate)
	if asOfDate != "" {
		lines = append(lines, fmt.Sprintf("As of date: %s", asOfDate))
	}
	lines = append(
		lines,
		fmt.Sprintf("Expires at: %s UTC", expiresAt.UTC().Format("2006-01-02 15:04:05")),
		"",
		fmt.Sprintf("Planned transactions (%d):", len(req.Transactions)),
	)

	baseMessage := strings.Join(lines, "\n")
	messageLen := len(baseMessage)
	renderedCount := 0
	for index := range req.Transactions {
		line := formatRebalanceConfirmationTransactionLine(index+1, req.Transactions[index])
		if line == "" {
			continue
		}
		// Keep enough room for footer and trailing lines.
		if messageLen+len(line)+2 > telegramMessageLimitChars-220 {
			break
		}
		lines = append(lines, line)
		messageLen += len(line) + 1
		renderedCount++
	}

	if len(req.Transactions) == 0 {
		lines = append(lines, "No actionable transactions were produced by planning.")
	}
	if renderedCount < len(req.Transactions) {
		lines = append(lines, fmt.Sprintf("... and %d more", len(req.Transactions)-renderedCount))
	}

	if link := s.buildRebalanceWebLink(req.PortfolioID, req.RunID); link != "" {
		lines = append(lines, "", "Review full draft in web:", link)
	}

	lines = append(lines, "", "Continue to execute now?")
	return strings.Join(lines, "\n")
}

func (s *VerificationService) buildRebalanceWebLink(portfolioID int, runID int) string {
	if s.cfg == nil {
		return ""
	}
	base := strings.TrimSpace(s.cfg.WebAppURL)
	if base == "" || portfolioID <= 0 || runID <= 0 {
		return ""
	}

	base = strings.TrimRight(base, "/")
	values := url.Values{}
	values.Set("portfolio_id", strconv.Itoa(portfolioID))
	values.Set("rebalance_id", strconv.Itoa(runID))
	return fmt.Sprintf("%s/portfolio/replication/drafts?%s", base, values.Encode())
}

func formatRebalanceConfirmationTransactionLine(
	sequence int,
	tx dto.PortfolioRebalanceTransaction,
) string {
	if sequence <= 0 {
		return ""
	}

	side := strings.ToUpper(strings.TrimSpace(tx.Side))
	if side == "" {
		side = "N/A"
	}

	ticker := strings.TrimSpace(tx.Ticker)
	if ticker == "" {
		ticker = strings.TrimSpace(tx.InstrumentID)
	}
	if ticker == "" {
		ticker = "UNKNOWN"
	}

	quantity := fmt.Sprintf("%.6f", tx.Quantity)
	quantity = strings.TrimRight(strings.TrimRight(quantity, "0"), ".")
	if quantity == "" {
		quantity = "0"
	}

	line := fmt.Sprintf("%d. %s %s qty=%s", sequence, side, ticker, quantity)
	if tx.Price != nil {
		line = fmt.Sprintf("%s price=%.6f", line, *tx.Price)
	}
	if tx.Amount != nil {
		line = fmt.Sprintf("%s amount=%.2f", line, *tx.Amount)
	}
	if strings.TrimSpace(tx.Currency) != "" {
		line = fmt.Sprintf("%s %s", line, strings.TrimSpace(tx.Currency))
	}
	return line
}
