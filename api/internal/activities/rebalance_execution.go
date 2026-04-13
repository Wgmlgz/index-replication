package activities

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"strconv"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/models"
	"server/internal/notifications"
	"server/internal/portfolio"
	"server/internal/repository"
	"server/internal/workflows"

	"github.com/google/uuid"
	"go.temporal.io/sdk/activity"
)

var rebalanceActionNamespace = uuid.MustParse("9be36bcf-7ac0-4f08-9f3c-3aa2283c8f21")

type rebalanceActionRunner interface {
	RunAction(ctx context.Context, userID int, id int, action string, payload map[string]interface{}) (*dto.PortfolioActionResponse, error)
}

type rebalanceNotificationSender interface {
	Send(ctx context.Context, req notifications.SendRequest) error
}

type RebalanceExecutionActivities struct {
	runsRepo         *repository.PortfolioRebalancesRepository
	portfolioService rebalanceActionRunner
	notifier         rebalanceNotificationSender
}

func NewRebalanceExecutionActivities(
	runsRepo *repository.PortfolioRebalancesRepository,
	portfolioService *portfolio.Service,
	notifier rebalanceNotificationSender,
) *RebalanceExecutionActivities {
	return &RebalanceExecutionActivities{
		runsRepo:         runsRepo,
		portfolioService: portfolioService,
		notifier:         notifier,
	}
}

func (a *RebalanceExecutionActivities) ExecuteRun(
	ctx context.Context,
	params workflows.RebalanceExecutionParams,
) (workflows.RebalanceExecutionResult, error) {
	result := workflows.RebalanceExecutionResult{
		RunID:     params.RunID,
		RunStatus: models.PortfolioRebalanceRunStatusExecuting,
		Progress: workflows.RebalanceExecutionProgress{
			StageCode:    "execution_starting",
			StageMessage: "Preparing execution run",
			IsTerminal:   false,
		},
		Items: []workflows.RebalanceExecutionItem{},
		Links: []workflows.RebalanceExecutionLink{},
	}
	if a == nil || a.runsRepo == nil || a.portfolioService == nil {
		return result, fmt.Errorf("rebalance execution activity is not initialized")
	}
	if params.UserID <= 0 || params.PortfolioID <= 0 || params.RunID <= 0 {
		return result, fmt.Errorf("invalid rebalance execution params")
	}

	run, err := a.runsRepo.GetRunByID(params.UserID, params.PortfolioID, params.RunID)
	if err != nil {
		return result, err
	}
	startedAt := time.Now().UTC()
	result.StartedAt = &startedAt
	if err := a.runsRepo.MarkRunExecutionStarted(params.UserID, params.PortfolioID, params.RunID, startedAt); err != nil {
		return result, err
	}

	items, err := loadExecutionItemsFromRunOutput(run.OutputJSON)
	if err != nil {
		return result, err
	}
	a.sendExecutionStartedNotification(ctx, params, run, len(items))
	result.Items = items
	setExecutionStage(
		&result,
		"execution_preparing_items",
		"Preparing execution items",
		0,
		len(result.Items),
	)
	recomputeExecutionProgress(&result)
	recordExecutionHeartbeat(ctx, &result)

	if !supportsAutomaticExecutionProvider(run.Provider) {
		setExecutionStage(
			&result,
			"execution_provider_unsupported",
			"Execution provider does not support automatic execution",
			0,
			len(result.Items),
		)
		result.RunStatus = models.PortfolioRebalanceRunStatusFailed
		finished := time.Now().UTC()
		result.EndedAt = &finished
		result.Progress.IsTerminal = true
		if markErr := a.runsRepo.MarkRunExecutionFinished(
			params.UserID,
			params.PortfolioID,
			params.RunID,
			models.PortfolioRebalanceRunStatusFailed,
			finished,
		); markErr != nil {
			return result, markErr
		}
		recordExecutionHeartbeat(ctx, &result)
		a.sendExecutionFinishedNotification(ctx, params, run, result)
		return result, nil
	}

	if len(result.Items) == 0 {
		setExecutionStage(
			&result,
			"execution_no_items",
			"No actionable items to execute",
			0,
			0,
		)
		result.RunStatus = models.PortfolioRebalanceRunStatusFailed
		finished := time.Now().UTC()
		result.EndedAt = &finished
		result.Progress.IsTerminal = true
		if markErr := a.runsRepo.MarkRunExecutionFinished(
			params.UserID,
			params.PortfolioID,
			params.RunID,
			models.PortfolioRebalanceRunStatusFailed,
			finished,
		); markErr != nil {
			return result, markErr
		}
		recordExecutionHeartbeat(ctx, &result)
		a.sendExecutionFinishedNotification(ctx, params, run, result)
		return result, nil
	}

	currencyByInstrument := parseCurrencyMap(run.InputJSON)
	lotSizeByInstrument := parseLotSizeMap(run.InputJSON)
	itemIndexByID := mapItemIndexByID(result.Items)

	for idx := range result.Items {
		item := result.Items[idx]
		snapshotIndex, ok := itemIndexByID[item.ID]
		if !ok {
			continue
		}

		switch item.Status {
		case models.PortfolioRebalanceItemStatusCompleted,
			models.PortfolioRebalanceItemStatusUnresolved,
			models.PortfolioRebalanceItemStatusFailed:
			continue
		}

		side := normalizeRebalanceSide(item)
		quantity := math.Abs(item.DeltaQuantity)
		if quantity <= 0 {
			link, linkErr := a.completeNoopItem(
				item,
				"zero delta quantity; execution skipped",
				map[string]interface{}{
					"item_id":  item.ID,
					"side":     side,
					"quantity": quantity,
				},
			)
			if linkErr != nil {
				return result, linkErr
			}
			applyCompletedItemResult(&result, snapshotIndex, "", link)
			recordExecutionHeartbeat(ctx, &result)
			continue
		}
		if side == "" {
			link, linkErr := a.failItem(
				item,
				"",
				"invalid rebalance item payload",
				map[string]interface{}{
					"item_id":  item.ID,
					"side":     side,
					"quantity": quantity,
				},
			)
			if linkErr != nil {
				return result, linkErr
			}
			applyFailedItemResult(&result, snapshotIndex, "", link)
			recordExecutionHeartbeat(ctx, &result)
			continue
		}

		stageMessage := fmt.Sprintf("Executing %s %s", strings.ToUpper(side), strings.TrimSpace(item.Ticker))
		if strings.TrimSpace(item.Ticker) == "" {
			stageMessage = fmt.Sprintf("Executing %s item %d", strings.ToUpper(side), idx+1)
		}
		setExecutionStage(
			&result,
			"execution_item_running",
			stageMessage,
			idx+1,
			len(result.Items),
		)
		result.Items[snapshotIndex].Status = models.PortfolioRebalanceItemStatusExecuting
		recomputeExecutionProgress(&result)
		recordExecutionHeartbeat(ctx, &result)

		resolvedInstrumentID := item.InstrumentID
		if resolvedInstrumentID == "" {
			link, linkErr := a.failItem(
				item,
				"",
				"missing instrument_id in planned item",
				map[string]interface{}{
					"item_id": item.ID,
					"ticker":  item.Ticker,
					"side":    side,
				},
			)
			if linkErr != nil {
				return result, linkErr
			}
			applyFailedItemResult(&result, snapshotIndex, "", link)
			recordExecutionHeartbeat(ctx, &result)
			continue
		}

		actionID := makeRebalanceActionID(params.RunID, item.ID, side)
		quantityPayload := interface{}(quantity)
		if requiresTBankLots(run.Provider) {
			lotSize := resolveItemLotSize(item, lotSizeByInstrument)
			lots, conversionErr := convertShareQuantityToLots(quantity, lotSize)
			if conversionErr != nil {
				link, linkErr := a.failItem(
					item,
					actionID,
					conversionErr.Error(),
					map[string]interface{}{
						"quantity_shares": quantity,
						"lot_size":        lotSize,
					},
				)
				if linkErr != nil {
					return result, linkErr
				}
				applyFailedItemResult(&result, snapshotIndex, actionID, link)
				recordExecutionHeartbeat(ctx, &result)
				continue
			}
			quantityPayload = lots
		}
		payload := map[string]interface{}{
			"action_id":     actionID,
			"ticker":        item.Ticker,
			"instrument_id": resolvedInstrumentID,
			"quantity":      quantityPayload,
			"executed_at":   run.AsOfDate.UTC().Format("2006-01-02"),
		}
		if requiresTBankLots(run.Provider) {
			payload["quantity_shares"] = quantity
			payload["lot_size"] = resolveItemLotSize(item, lotSizeByInstrument)
		}
		if item.ReferencePrice != nil && *item.ReferencePrice > 0 {
			payload["price"] = *item.ReferencePrice
		}
		if item.PlannedAmount != nil && math.Abs(*item.PlannedAmount) > 0 {
			payload["amount"] = math.Abs(*item.PlannedAmount)
		}
		if currency := resolveItemCurrency(item, currencyByInstrument); currency != "" {
			payload["currency"] = currency
		}
		if side == models.PortfolioRebalanceItemSideBuy && requiresBuyReferencePrice(run.Provider) {
			if _, ok := payload["price"]; !ok {
				link, linkErr := a.failItem(
					item,
					actionID,
					"missing reference price for buy action",
					map[string]interface{}{"payload": payload},
				)
				if linkErr != nil {
					return result, linkErr
				}
				applyFailedItemResult(&result, snapshotIndex, actionID, link)
				recordExecutionHeartbeat(ctx, &result)
				continue
			}
		}

		resp, runErr := a.portfolioService.RunAction(ctx, params.UserID, params.PortfolioID, side, payload)
		if runErr != nil {
			link, linkErr := a.failItem(item, actionID, runErr.Error(), map[string]interface{}{
				"payload": payload,
			})
			if linkErr != nil {
				return result, linkErr
			}
			applyFailedItemResult(&result, snapshotIndex, actionID, link)
			recordExecutionHeartbeat(ctx, &result)
			continue
		}

		link, linkErr := a.completeItem(item, actionID, payload, resp)
		if linkErr != nil {
			return result, linkErr
		}
		applyCompletedItemResult(&result, snapshotIndex, actionID, link)
		recordExecutionHeartbeat(ctx, &result)
	}

	setExecutionStage(
		&result,
		"execution_finalizing",
		"Finalizing execution result",
		len(result.Items),
		len(result.Items),
	)
	recomputeExecutionProgress(&result)

	finalStatus := resolveFinalRunStatus(result.Progress)
	result.RunStatus = finalStatus
	result.Progress.IsTerminal = true
	switch finalStatus {
	case models.PortfolioRebalanceRunStatusCompleted:
		setExecutionStage(
			&result,
			"execution_completed",
			"Execution completed",
			len(result.Items),
			len(result.Items),
		)
	case models.PortfolioRebalanceRunStatusPartiallyCompleted:
		setExecutionStage(
			&result,
			"execution_partially_completed",
			"Execution partially completed",
			len(result.Items),
			len(result.Items),
		)
	default:
		setExecutionStage(
			&result,
			"execution_failed",
			"Execution failed",
			len(result.Items),
			len(result.Items),
		)
	}
	recomputeExecutionProgress(&result)
	finishedAt := time.Now().UTC()
	result.EndedAt = &finishedAt
	if err := a.runsRepo.MarkRunExecutionFinished(
		params.UserID,
		params.PortfolioID,
		params.RunID,
		finalStatus,
		finishedAt,
	); err != nil {
		return result, err
	}
	recordExecutionHeartbeat(ctx, &result)
	a.sendExecutionFinishedNotification(ctx, params, run, result)
	return result, nil
}

func (a *RebalanceExecutionActivities) sendExecutionStartedNotification(
	ctx context.Context,
	params workflows.RebalanceExecutionParams,
	run *models.PortfolioRebalanceRun,
	totalItems int,
) {
	if a == nil || a.notifier == nil {
		return
	}
	asOf := ""
	if run != nil && !run.AsOfDate.IsZero() {
		asOf = run.AsOfDate.UTC().Format("2006-01-02")
	}
	provider := ""
	if run != nil {
		provider = strings.TrimSpace(run.Provider)
	}

	lines := []string{
		fmt.Sprintf("Portfolio #%d", params.PortfolioID),
		fmt.Sprintf("Planned items: %d", totalItems),
	}
	if provider != "" {
		lines = append(lines, fmt.Sprintf("Provider: %s", provider))
	}
	if asOf != "" {
		lines = append(lines, fmt.Sprintf("As-of: %s", asOf))
	}

	if err := a.notifier.Send(ctx, notifications.SendRequest{
		UserID: params.UserID,
		Message: notifications.Message{
			Subject: fmt.Sprintf("Rebalance execution started: run #%d", params.RunID),
			Body:    strings.Join(lines, "\n"),
		},
	}); err != nil {
		log.Printf(
			"rebalance execution: failed to send start notification user_id=%d portfolio_id=%d run_id=%d err=%v",
			params.UserID,
			params.PortfolioID,
			params.RunID,
			err,
		)
	}
}

func (a *RebalanceExecutionActivities) sendExecutionFinishedNotification(
	ctx context.Context,
	params workflows.RebalanceExecutionParams,
	run *models.PortfolioRebalanceRun,
	result workflows.RebalanceExecutionResult,
) {
	if a == nil || a.notifier == nil {
		return
	}
	status := strings.TrimSpace(result.RunStatus)
	if status == "" {
		status = models.PortfolioRebalanceRunStatusFailed
	}
	subject := fmt.Sprintf("Rebalance execution finished (%s): run #%d", status, params.RunID)

	asOf := ""
	if run != nil && !run.AsOfDate.IsZero() {
		asOf = run.AsOfDate.UTC().Format("2006-01-02")
	}
	summary := buildExecutionNotificationSummary(result.Progress)
	lines := []string{
		fmt.Sprintf("Portfolio #%d", params.PortfolioID),
		fmt.Sprintf("Summary: %s", summary),
	}
	if asOf != "" {
		lines = append(lines, fmt.Sprintf("As-of: %s", asOf))
	}

	if err := a.notifier.Send(ctx, notifications.SendRequest{
		UserID: params.UserID,
		Message: notifications.Message{
			Subject: subject,
			Body:    strings.Join(lines, "\n"),
		},
	}); err != nil {
		log.Printf(
			"rebalance execution: failed to send completion notification user_id=%d portfolio_id=%d run_id=%d err=%v",
			params.UserID,
			params.PortfolioID,
			params.RunID,
			err,
		)
	}
}

func buildExecutionNotificationSummary(progress workflows.RebalanceExecutionProgress) string {
	return fmt.Sprintf(
		"total %d, completed %d, failed %d, unresolved %d",
		progress.TotalItems,
		progress.CompletedItems,
		progress.FailedItems,
		progress.UnresolvedItems,
	)
}

func (a *RebalanceExecutionActivities) failItem(
	item workflows.RebalanceExecutionItem,
	actionID string,
	errMsg string,
	metadata map[string]interface{},
) (*workflows.RebalanceExecutionLink, error) {
	now := time.Now().UTC()
	link := &workflows.RebalanceExecutionLink{
		RebalanceItemID: intPtr(item.ID),
		Status:          models.PortfolioRebalanceItemStatusFailed,
		Metadata: map[string]interface{}{
			"action_id": actionID,
			"error":     errMsg,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	for key, value := range metadata {
		link.Metadata[key] = value
	}
	return link, nil
}

func (a *RebalanceExecutionActivities) completeItem(
	item workflows.RebalanceExecutionItem,
	actionID string,
	payload map[string]interface{},
	resp *dto.PortfolioActionResponse,
) (*workflows.RebalanceExecutionLink, error) {
	now := time.Now().UTC()
	link := &workflows.RebalanceExecutionLink{
		RebalanceItemID:     intPtr(item.ID),
		ProviderOperationID: parseProviderOperationID(resp),
		Status:              models.PortfolioRebalanceItemStatusCompleted,
		Metadata: map[string]interface{}{
			"action_id": actionID,
			"payload":   payload,
			"result":    actionResultMap(resp),
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	return link, nil
}

func (a *RebalanceExecutionActivities) completeNoopItem(
	item workflows.RebalanceExecutionItem,
	reason string,
	metadata map[string]interface{},
) (*workflows.RebalanceExecutionLink, error) {
	now := time.Now().UTC()
	link := &workflows.RebalanceExecutionLink{
		RebalanceItemID: intPtr(item.ID),
		Status:          models.PortfolioRebalanceItemStatusCompleted,
		Metadata: map[string]interface{}{
			"reason": reason,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
	for key, value := range metadata {
		link.Metadata[key] = value
	}
	return link, nil
}

func mapItemIndexByID(items []workflows.RebalanceExecutionItem) map[int]int {
	result := make(map[int]int, len(items))
	for i := range items {
		result[items[i].ID] = i
	}
	return result
}

func applyFailedItemResult(
	result *workflows.RebalanceExecutionResult,
	itemIndex int,
	actionID string,
	link *workflows.RebalanceExecutionLink,
) {
	if result == nil || itemIndex < 0 || itemIndex >= len(result.Items) {
		return
	}
	errMsg := metadataString(link.Metadata, "error")
	result.Items[itemIndex].Status = models.PortfolioRebalanceItemStatusFailed
	result.Items[itemIndex].LastError = strPtr(errMsg)
	result.Items[itemIndex].LastActionID = strPtr(actionID)
	result.Items[itemIndex].ProviderOperationID = cloneStringPtr(link.ProviderOperationID)
	now := timestampOrNow(link.CreatedAt)
	result.Items[itemIndex].LastEventAt = &now
	appendExecutionLink(result, link)
	recomputeExecutionProgress(result)
}

func applyCompletedItemResult(
	result *workflows.RebalanceExecutionResult,
	itemIndex int,
	actionID string,
	link *workflows.RebalanceExecutionLink,
) {
	if result == nil || itemIndex < 0 || itemIndex >= len(result.Items) {
		return
	}
	result.Items[itemIndex].Status = models.PortfolioRebalanceItemStatusCompleted
	result.Items[itemIndex].LastError = nil
	result.Items[itemIndex].LastActionID = strPtr(actionID)
	result.Items[itemIndex].ProviderOperationID = cloneStringPtr(link.ProviderOperationID)
	now := timestampOrNow(link.CreatedAt)
	result.Items[itemIndex].LastEventAt = &now
	appendExecutionLink(result, link)
	recomputeExecutionProgress(result)
}

func recomputeExecutionProgress(result *workflows.RebalanceExecutionResult) {
	if result == nil {
		return
	}
	progress := workflows.RebalanceExecutionProgress{
		TotalItems:      len(result.Items),
		ActionableItems: len(result.Items),
		StageCode:       result.Progress.StageCode,
		StageMessage:    result.Progress.StageMessage,
		StageIndex:      result.Progress.StageIndex,
		StageTotal:      result.Progress.StageTotal,
		IsTerminal:      result.Progress.IsTerminal,
	}
	for i := range result.Items {
		item := result.Items[i]
		progress.LastEventAt = laterTimePtr(progress.LastEventAt, item.LastEventAt)
		switch item.Status {
		case models.PortfolioRebalanceItemStatusUnresolved:
			progress.UnresolvedItems++
			progress.ActionableItems--
		case models.PortfolioRebalanceItemStatusExecuting:
			progress.ExecutingItems++
		case models.PortfolioRebalanceItemStatusCompleted:
			progress.CompletedItems++
		case models.PortfolioRebalanceItemStatusFailed:
			progress.FailedItems++
		default:
			progress.PendingItems++
		}
	}
	terminalItems := progress.CompletedItems + progress.FailedItems
	if progress.ActionableItems > 0 {
		progress.CompletionPercent = math.Min(
			100,
			(100*float64(terminalItems))/float64(progress.ActionableItems),
		)
	} else if progress.TotalItems == 0 || progress.IsTerminal {
		progress.CompletionPercent = 100
	}
	result.Progress = progress
}

func setExecutionStage(
	result *workflows.RebalanceExecutionResult,
	stageCode string,
	stageMessage string,
	stageIndex int,
	stageTotal int,
) {
	if result == nil {
		return
	}
	result.Progress.StageCode = stageCode
	result.Progress.StageMessage = stageMessage
	result.Progress.StageIndex = stageIndex
	result.Progress.StageTotal = stageTotal
}

func resolveFinalRunStatus(progress workflows.RebalanceExecutionProgress) string {
	if progress.CompletedItems > 0 && progress.FailedItems > 0 {
		return models.PortfolioRebalanceRunStatusPartiallyCompleted
	}
	if progress.FailedItems > 0 && progress.CompletedItems == 0 {
		return models.PortfolioRebalanceRunStatusFailed
	}
	return models.PortfolioRebalanceRunStatusCompleted
}

func appendExecutionLink(
	result *workflows.RebalanceExecutionResult,
	link *workflows.RebalanceExecutionLink,
) {
	if result == nil || link == nil {
		return
	}
	copied := *link
	if copied.ID <= 0 {
		copied.ID = len(result.Links) + 1
	}
	if copied.CreatedAt.IsZero() {
		copied.CreatedAt = time.Now().UTC()
	}
	if copied.UpdatedAt.IsZero() {
		copied.UpdatedAt = copied.CreatedAt
	}
	copied.Metadata = copyMetadata(copied.Metadata)
	result.Links = append(result.Links, copied)
}

func timestampOrNow(value time.Time) time.Time {
	if value.IsZero() {
		return time.Now().UTC()
	}
	return value.UTC()
}

func recordExecutionHeartbeat(ctx context.Context, result *workflows.RebalanceExecutionResult) {
	if result == nil {
		return
	}
	copy := *result
	copy.Items = append([]workflows.RebalanceExecutionItem{}, result.Items...)
	copy.Links = append([]workflows.RebalanceExecutionLink{}, result.Links...)
	activity.RecordHeartbeat(ctx, copy)
}

func makeRebalanceActionID(runID int, itemID int, side string) string {
	token := fmt.Sprintf("rebalance:%d:item:%d:side:%s", runID, itemID, strings.TrimSpace(side))
	return uuid.NewSHA1(rebalanceActionNamespace, []byte(token)).String()
}

func normalizeRebalanceSide(item workflows.RebalanceExecutionItem) string {
	side := strings.ToLower(strings.TrimSpace(item.Side))
	if side == models.PortfolioRebalanceItemSideBuy || side == models.PortfolioRebalanceItemSideSell {
		return side
	}
	if item.DeltaQuantity < 0 {
		return models.PortfolioRebalanceItemSideSell
	}
	return models.PortfolioRebalanceItemSideBuy
}

func supportsAutomaticExecutionProvider(provider string) bool {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "virtual", "tbank":
		return true
	default:
		return false
	}
}

func requiresBuyReferencePrice(provider string) bool {
	return strings.EqualFold(strings.TrimSpace(provider), "virtual")
}

func resolveItemCurrency(item workflows.RebalanceExecutionItem, currencyByInstrument map[string]string) string {
	key := item.InstrumentID
	if key == "" {
		key = item.Ticker
	}
	return currencyByInstrument[key]
}

func resolveItemLotSize(item workflows.RebalanceExecutionItem, lotSizeByInstrument map[string]int64) int64 {
	key := item.InstrumentID
	if key == "" {
		key = item.Ticker
	}
	if lotSize := lotSizeByInstrument[key]; lotSize > 0 {
		return lotSize
	}
	return 1
}

func parseLotSizeMap(inputJSON map[string]interface{}) map[string]int64 {
	result := map[string]int64{}
	if len(inputJSON) == 0 {
		return result
	}
	encoded, err := json.Marshal(inputJSON)
	if err != nil {
		return result
	}
	var input dto.PortfolioRebalanceInput
	if err := json.Unmarshal(encoded, &input); err != nil {
		return result
	}
	for _, row := range input.Instruments {
		key := row.InstrumentID
		if key == "" {
			key = row.Ticker
		}
		if key == "" {
			continue
		}
		if row.LotSize > 0 {
			result[key] = row.LotSize
		}
	}
	return result
}

func requiresTBankLots(provider string) bool {
	return strings.EqualFold(strings.TrimSpace(provider), "tbank")
}

func convertShareQuantityToLots(shareQuantity float64, lotSize int64) (int64, error) {
	if shareQuantity <= 0 {
		return 0, fmt.Errorf("invalid rebalance quantity %.8f", shareQuantity)
	}
	if lotSize <= 0 {
		lotSize = 1
	}
	lotSizeFloat := float64(lotSize)
	lotsFloat := shareQuantity / lotSizeFloat
	lotsRounded := math.Round(lotsFloat)
	if math.Abs(lotsFloat-lotsRounded) > 1e-6 {
		return 0, fmt.Errorf(
			"rebalance quantity %.8f is not divisible by lot size %d",
			shareQuantity,
			lotSize,
		)
	}
	lots := int64(lotsRounded)
	if lots <= 0 {
		return 0, fmt.Errorf("invalid lots quantity %.8f for lot size %d", shareQuantity, lotSize)
	}
	return lots, nil
}

func parseCurrencyMap(inputJSON map[string]interface{}) map[string]string {
	result := map[string]string{}
	if len(inputJSON) == 0 {
		return result
	}
	encoded, err := json.Marshal(inputJSON)
	if err != nil {
		return result
	}
	var input dto.PortfolioRebalanceInput
	if err := json.Unmarshal(encoded, &input); err != nil {
		return result
	}
	for _, row := range input.Instruments {
		key := row.InstrumentID
		if key == "" {
			key = row.Ticker
		}
		if key == "" {
			continue
		}
		result[key] = strings.TrimSpace(row.Currency)
	}
	return result
}

func loadExecutionItemsFromRunOutput(
	outputJSON map[string]interface{},
) ([]workflows.RebalanceExecutionItem, error) {
	if len(outputJSON) == 0 {
		return []workflows.RebalanceExecutionItem{}, nil
	}

	encoded, err := json.Marshal(outputJSON)
	if err != nil {
		return nil, err
	}

	var output dto.PortfolioRebalanceOutput
	if err := json.Unmarshal(encoded, &output); err != nil {
		return nil, err
	}

	result := make([]workflows.RebalanceExecutionItem, 0, len(output.Items))
	for i := range output.Items {
		row := output.Items[i]
		status := strings.TrimSpace(row.Status)
		if status == "" {
			status = models.PortfolioRebalanceItemStatusPlanned
		}
		result = append(result, workflows.RebalanceExecutionItem{
			ID:              i + 1,
			Ticker:          row.Ticker,
			InstrumentID:    row.InstrumentID,
			Side:            strings.TrimSpace(row.Side),
			CurrentQuantity: row.CurrentQuantity,
			TargetQuantity:  row.TargetQuantity,
			DeltaQuantity:   row.DeltaQuantity,
			ReferencePrice:  cloneFloatPtr(row.ReferencePrice),
			PlannedAmount:   cloneFloatPtr(row.PlannedAmount),
			Status:          status,
		})
	}
	return result, nil
}

func parseProviderOperationID(resp *dto.PortfolioActionResponse) *string {
	if resp == nil || resp.Result == nil {
		return nil
	}
	rawOperationID, ok := resp.Result["operation_id"]
	if !ok || rawOperationID == nil {
		rawOperationID, ok = resp.Result["order_id"]
		if !ok || rawOperationID == nil {
			return nil
		}
	}
	switch typed := rawOperationID.(type) {
	case string:
		value := strings.TrimSpace(typed)
		if value == "" {
			return nil
		}
		return &value
	case int:
		value := strconv.Itoa(typed)
		return &value
	case int64:
		value := strconv.FormatInt(typed, 10)
		return &value
	case float64:
		value := strconv.FormatInt(int64(math.Round(typed)), 10)
		return &value
	default:
		return nil
	}
}

func actionResultMap(resp *dto.PortfolioActionResponse) map[string]interface{} {
	if resp == nil || resp.Result == nil {
		return map[string]interface{}{}
	}
	result := map[string]interface{}{}
	for key, value := range resp.Result {
		result[key] = value
	}
	return result
}

func metadataString(metadata map[string]interface{}, key string) string {
	if len(metadata) == 0 {
		return ""
	}
	raw, ok := metadata[key]
	if !ok || raw == nil {
		return ""
	}
	value, ok := raw.(string)
	if !ok {
		return ""
	}
	return value
}

func copyMetadata(source map[string]interface{}) map[string]interface{} {
	if len(source) == 0 {
		return map[string]interface{}{}
	}
	result := make(map[string]interface{}, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}

func cloneStringPtr(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneFloatPtr(value *float64) *float64 {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func laterTimePtr(base *time.Time, candidate *time.Time) *time.Time {
	if candidate == nil {
		return base
	}
	if base == nil || candidate.After(*base) {
		copy := candidate.UTC()
		return &copy
	}
	return base
}

func strPtr(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	copy := value
	return &copy
}

func intPtr(value int) *int {
	copy := value
	return &copy
}
