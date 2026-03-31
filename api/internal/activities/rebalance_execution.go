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
	result := workflows.RebalanceExecutionResult{}
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
	if run.Provider != "virtual" {
		_ = a.runsRepo.MarkRunExecutionFinished(params.UserID, params.PortfolioID, params.RunID, models.PortfolioRebalanceRunStatusFailed, time.Now().UTC())
		return result, fmt.Errorf("unsupported provider for execution: %s", run.Provider)
	}

	if err := a.runsRepo.MarkRunExecutionStarted(params.UserID, params.PortfolioID, params.RunID, time.Now().UTC()); err != nil {
		return result, err
	}

	items, err := a.runsRepo.ListItemsByRunID(params.RunID)
	if err != nil {
		return result, err
	}
	if len(items) == 0 {
		_ = a.runsRepo.MarkRunExecutionFinished(params.UserID, params.PortfolioID, params.RunID, models.PortfolioRebalanceRunStatusFailed, time.Now().UTC())
		return result, fmt.Errorf("no persisted run items for rebalance run %d", params.RunID)
	}

	currencyByInstrument := parseCurrencyMap(run.InputJSON)

	for idx := range items {
		item := items[idx]
		if item.Status == models.PortfolioRebalanceItemStatusCompleted || item.Status == models.PortfolioRebalanceItemStatusUnresolved {
			continue
		}
		if item.Status == models.PortfolioRebalanceItemStatusFailed {
			result.Failed++
			continue
		}
		result.Total++

		side := normalizeRebalanceSide(item)
		quantity := math.Abs(item.DeltaQuantity)
		if side == "" || quantity <= 0 {
			result.Failed++
			_ = a.runsRepo.UpdateItemStatus(params.RunID, item.ID, models.PortfolioRebalanceItemStatusFailed)
			_ = a.runsRepo.CreateExecutionLink(&models.PortfolioRebalanceExecutionLink{
				RebalanceRunID:  params.RunID,
				RebalanceItemID: intPtr(item.ID),
				Status:          models.PortfolioRebalanceItemStatusFailed,
				MetadataJSON: map[string]interface{}{
					"error":    "invalid rebalance item payload",
					"item_id":  item.ID,
					"side":     side,
					"quantity": quantity,
				},
			})
			continue
		}

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
		if side == models.PortfolioRebalanceItemSideBuy {
			if _, ok := payload["price"]; !ok {
				result.Failed++
				_ = a.runsRepo.UpdateItemStatus(params.RunID, item.ID, models.PortfolioRebalanceItemStatusFailed)
				_ = a.runsRepo.CreateExecutionLink(&models.PortfolioRebalanceExecutionLink{
					RebalanceRunID:  params.RunID,
					RebalanceItemID: intPtr(item.ID),
					Status:          models.PortfolioRebalanceItemStatusFailed,
					MetadataJSON: map[string]interface{}{
						"action_id": actionID,
						"error":     "missing reference price for buy action",
						"payload":   payload,
					},
				})
				continue
			}
		}

		_ = a.runsRepo.UpdateItemStatus(params.RunID, item.ID, models.PortfolioRebalanceItemStatusExecuting)

		resp, runErr := a.portfolioService.RunAction(ctx, params.UserID, params.PortfolioID, side, payload)
		if runErr != nil {
			result.Failed++
			_ = a.runsRepo.UpdateItemStatus(params.RunID, item.ID, models.PortfolioRebalanceItemStatusFailed)
			_ = a.runsRepo.CreateExecutionLink(&models.PortfolioRebalanceExecutionLink{
				RebalanceRunID:  params.RunID,
				RebalanceItemID: intPtr(item.ID),
				Status:          models.PortfolioRebalanceItemStatusFailed,
				MetadataJSON: map[string]interface{}{
					"action_id": actionID,
					"error":     runErr.Error(),
					"payload":   payload,
				},
			})
			continue
		}

		result.Completed++
		_ = a.runsRepo.UpdateItemStatus(params.RunID, item.ID, models.PortfolioRebalanceItemStatusCompleted)
		_ = a.runsRepo.CreateExecutionLink(&models.PortfolioRebalanceExecutionLink{
			RebalanceRunID:      params.RunID,
			RebalanceItemID:     intPtr(item.ID),
			ProviderOperationID: parseProviderOperationID(resp),
			Status:              models.PortfolioRebalanceItemStatusCompleted,
			MetadataJSON: map[string]interface{}{
				"action_id": actionID,
				"payload":   payload,
				"result":    actionResultMap(resp),
			},
		})
	}

	finalStatus := models.PortfolioRebalanceRunStatusCompleted
	if result.Failed > 0 && result.Completed > 0 {
		finalStatus = models.PortfolioRebalanceRunStatusPartiallyCompleted
	} else if result.Failed > 0 && result.Completed == 0 {
		finalStatus = models.PortfolioRebalanceRunStatusFailed
	}
	if result.Total == 0 {
		finalStatus = models.PortfolioRebalanceRunStatusCompleted
	}
	if err := a.runsRepo.MarkRunExecutionFinished(params.UserID, params.PortfolioID, params.RunID, finalStatus, time.Now().UTC()); err != nil {
		return result, err
	}
	return result, nil
}

func makeRebalanceActionID(runID int, itemID int, side string) string {
	token := fmt.Sprintf("rebalance:%d:item:%d:side:%s", runID, itemID, strings.TrimSpace(side))
	return uuid.NewSHA1(rebalanceActionNamespace, []byte(token)).String()
}

func normalizeRebalanceSide(item models.PortfolioRebalanceItem) string {
	side := strings.ToLower(strings.TrimSpace(item.Side))
	if side == models.PortfolioRebalanceItemSideBuy || side == models.PortfolioRebalanceItemSideSell {
		return side
	}
	if item.DeltaQuantity < 0 {
		return models.PortfolioRebalanceItemSideSell
	}
	return models.PortfolioRebalanceItemSideBuy
}

func resolveItemCurrency(item models.PortfolioRebalanceItem, currencyByInstrument map[string]string) string {
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

func parseProviderOperationID(resp *dto.PortfolioActionResponse) *string {
	if resp == nil || resp.Result == nil {
		return nil
	}
	rawOperationID, ok := resp.Result["operation_id"]
	if !ok || rawOperationID == nil {
		return nil
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

func intPtr(value int) *int {
	copy := value
	return &copy
}
