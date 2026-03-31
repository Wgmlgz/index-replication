package activities

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"server/internal/api/dto"
	"server/internal/models"
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

type RebalanceExecutionActivities struct {
	runsRepo         *repository.PortfolioRebalancesRepository
	portfolioService rebalanceActionRunner
}

func NewRebalanceExecutionActivities(
	runsRepo *repository.PortfolioRebalancesRepository,
	portfolioService *portfolio.Service,
) *RebalanceExecutionActivities {
	return &RebalanceExecutionActivities{
		runsRepo:         runsRepo,
		portfolioService: portfolioService,
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
			IsTerminal: false,
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
	result.Items = items
	recomputeExecutionProgress(&result)
	recordExecutionHeartbeat(ctx, &result)

	if !supportsAutomaticExecutionProvider(run.Provider) {
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
		return result, nil
	}

	if len(result.Items) == 0 {
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
		return result, nil
	}

	currencyByInstrument := parseCurrencyMap(run.InputJSON)
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

		result.Items[snapshotIndex].Status = models.PortfolioRebalanceItemStatusExecuting
		recomputeExecutionProgress(&result)
		recordExecutionHeartbeat(ctx, &result)

		actionID := makeRebalanceActionID(params.RunID, item.ID, side)
		payload := map[string]interface{}{
			"action_id":     actionID,
			"ticker":        strings.TrimSpace(item.Ticker),
			"instrument_id": strings.TrimSpace(item.InstrumentID),
			"quantity":      quantity,
			"executed_at":   run.AsOfDate.UTC().Format("2006-01-02"),
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

	finalStatus := resolveFinalRunStatus(result.Progress)
	result.RunStatus = finalStatus
	result.Progress.IsTerminal = true
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
	return result, nil
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
	key := strings.ToUpper(strings.TrimSpace(item.InstrumentID))
	if key == "" {
		key = strings.ToUpper(strings.TrimSpace(item.Ticker))
	}
	return strings.TrimSpace(currencyByInstrument[key])
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
		key := strings.ToUpper(strings.TrimSpace(row.InstrumentID))
		if key == "" {
			key = strings.ToUpper(strings.TrimSpace(row.Ticker))
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
			Ticker:          strings.TrimSpace(row.Ticker),
			InstrumentID:    strings.TrimSpace(row.InstrumentID),
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
