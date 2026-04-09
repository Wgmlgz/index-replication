package rebalance

import (
	"time"

	"server/internal/models"
	"server/internal/workflows"
)

const (
	planningStageTotal = 6

	planningStageCodeQueued          = "planning_queued"
	planningStageCodeStarted         = "planning_started"
	planningStageCodeSnapshotLoading = "planning_snapshot_loading"
	planningStageCodeAlgorithm       = "planning_algorithm_running"
	planningStageCodeEncoding        = "planning_encoding_output"
	planningStageCodePersisting      = "planning_persisting"
	planningStageCodeCompleted       = "planning_completed"
	planningStageCodeFailed          = "planning_failed"
)

func planningProgressQueued(at *time.Time) workflows.RebalancePlanningProgress {
	progress := workflows.RebalancePlanningProgress{
		TotalItems:        planningStageTotal,
		ActionableItems:   planningStageTotal,
		PendingItems:      planningStageTotal,
		CompletionPercent: 0,
		StageCode:         planningStageCodeQueued,
		StageMessage:      "Waiting in planning queue",
		StageIndex:        0,
		StageTotal:        planningStageTotal,
		IsTerminal:        false,
	}
	if at != nil {
		value := at.UTC()
		progress.LastEventAt = &value
	}
	return progress
}

func planningProgressStarted(at time.Time) workflows.RebalancePlanningProgress {
	return planningProgressInFlight(
		planningStageCodeStarted,
		"Planning run started",
		1,
		10,
		at,
	)
}

func planningProgressSnapshotLoading(at time.Time) workflows.RebalancePlanningProgress {
	return planningProgressInFlight(
		planningStageCodeSnapshotLoading,
		"Loading portfolio and benchmark snapshot",
		2,
		30,
		at,
	)
}

func planningProgressAlgorithmRunning(at time.Time) workflows.RebalancePlanningProgress {
	return planningProgressInFlight(
		planningStageCodeAlgorithm,
		"Running planning algorithm",
		3,
		60,
		at,
	)
}

func planningProgressEncoding(at time.Time) workflows.RebalancePlanningProgress {
	return planningProgressInFlight(
		planningStageCodeEncoding,
		"Encoding planning output",
		4,
		80,
		at,
	)
}

func planningProgressPersisting(at time.Time) workflows.RebalancePlanningProgress {
	return planningProgressInFlight(
		planningStageCodePersisting,
		"Persisting planning draft",
		5,
		95,
		at,
	)
}

func planningProgressCompleted(at time.Time) workflows.RebalancePlanningProgress {
	progress := workflows.RebalancePlanningProgress{
		TotalItems:        planningStageTotal,
		ActionableItems:   planningStageTotal,
		CompletedItems:    planningStageTotal,
		CompletionPercent: 100,
		StageCode:         planningStageCodeCompleted,
		StageMessage:      "Planning finished",
		StageIndex:        planningStageTotal,
		StageTotal:        planningStageTotal,
		IsTerminal:        true,
	}
	value := at.UTC()
	progress.LastEventAt = &value
	return progress
}

func planningProgressFailed(stageCode string, stageMessage string, at time.Time) workflows.RebalancePlanningProgress {
	code := stageCode
	if code == "" {
		code = planningStageCodeFailed
	}
	message := stageMessage
	if message == "" {
		message = "Planning failed"
	}
	progress := workflows.RebalancePlanningProgress{
		TotalItems:        planningStageTotal,
		ActionableItems:   planningStageTotal,
		CompletedItems:    planningStageTotal - 1,
		FailedItems:       1,
		CompletionPercent: 100,
		StageCode:         code,
		StageMessage:      message,
		StageIndex:        planningStageTotal,
		StageTotal:        planningStageTotal,
		IsTerminal:        true,
	}
	value := at.UTC()
	progress.LastEventAt = &value
	return progress
}

func planningProgressInFlight(
	stageCode string,
	stageMessage string,
	stageIndex int,
	completionPercent float64,
	at time.Time,
) workflows.RebalancePlanningProgress {
	if stageIndex < 1 {
		stageIndex = 1
	}
	if stageIndex >= planningStageTotal {
		stageIndex = planningStageTotal - 1
	}
	completed := stageIndex - 1
	pending := planningStageTotal - completed - 1
	if pending < 0 {
		pending = 0
	}

	progress := workflows.RebalancePlanningProgress{
		TotalItems:        planningStageTotal,
		ActionableItems:   planningStageTotal,
		PendingItems:      pending,
		ExecutingItems:    1,
		CompletedItems:    completed,
		CompletionPercent: completionPercent,
		StageCode:         stageCode,
		StageMessage:      stageMessage,
		StageIndex:        stageIndex,
		StageTotal:        planningStageTotal,
		IsTerminal:        false,
	}
	value := at.UTC()
	progress.LastEventAt = &value
	return progress
}

func planningProgressFallbackForRun(run *models.PortfolioRebalanceRun) (workflows.RebalancePlanningProgress, bool) {
	if run == nil {
		return workflows.RebalancePlanningProgress{}, false
	}

	switch run.Status {
	case models.PortfolioRebalanceRunStatusPlanningQueued:
		createdAt := run.CreatedAt
		return planningProgressQueued(&createdAt), true
	case models.PortfolioRebalanceRunStatusPlanning:
		if run.StartedAt != nil {
			return planningProgressStarted(*run.StartedAt), true
		}
		return planningProgressStarted(time.Now().UTC()), true
	case models.PortfolioRebalanceRunStatusDraft:
		if run.EndedAt != nil {
			return planningProgressCompleted(*run.EndedAt), true
		}
		return planningProgressCompleted(time.Now().UTC()), true
	case models.PortfolioRebalanceRunStatusPlanningFailed:
		if run.EndedAt != nil {
			return planningProgressFailed(planningStageCodeFailed, "Planning failed", *run.EndedAt), true
		}
		return planningProgressFailed(planningStageCodeFailed, "Planning failed", time.Now().UTC()), true
	default:
		return workflows.RebalancePlanningProgress{}, false
	}
}
