package notifications

import (
	"strings"
	"testing"
)

func TestBuildRebalanceExecutionStartedMessage(t *testing.T) {
	msg, err := BuildRebalanceExecutionStartedMessage("en", RebalanceExecutionStartedTemplateData{
		RunID:        42,
		PortfolioID:  7,
		PlannedItems: 5,
		Provider:     "tbank",
		AsOfDate:     "2026-04-13",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msg.Subject != "Rebalance execution started: run #42" {
		t.Fatalf("unexpected subject: %q", msg.Subject)
	}
	if !strings.Contains(msg.Body, "Portfolio #7") {
		t.Fatalf("expected portfolio line in body, got %q", msg.Body)
	}
	if !strings.Contains(msg.Body, "Provider: tbank") {
		t.Fatalf("expected provider line in body, got %q", msg.Body)
	}
}

func TestBuildRebalanceExecutionFinishedMessageFallbackLanguage(t *testing.T) {
	msg, err := BuildRebalanceExecutionFinishedMessage("ru", RebalanceExecutionFinishedTemplateData{
		RunID:           101,
		PortfolioID:     8,
		Status:          "completed",
		TotalItems:      10,
		CompletedItems:  9,
		FailedItems:     1,
		UnresolvedItems: 0,
		AsOfDate:        "2026-04-13",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if msg.Subject != "Rebalance execution finished (completed): run #101" {
		t.Fatalf("unexpected subject: %q", msg.Subject)
	}
	if !strings.Contains(msg.Body, "Summary: total 10, completed 9, failed 1, unresolved 0") {
		t.Fatalf("expected summary line in body, got %q", msg.Body)
	}
}
