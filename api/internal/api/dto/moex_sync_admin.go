package dto

import (
	"time"

	"server/internal/models"
)

type MoexSyncStateResponse struct {
	Dataset             string     `json:"dataset"`
	EntityKey           string     `json:"entityKey"`
	CheckedThroughDate  *time.Time `json:"checkedThroughDate"`
	ImmutableBeforeDate *time.Time `json:"immutableBeforeDate"`
	MutableSinceDate    *time.Time `json:"mutableSinceDate"`
	Status              string     `json:"status"`
	LastSuccessAt       *time.Time `json:"lastSuccessAt"`
	LastAttemptAt       *time.Time `json:"lastAttemptAt"`
	RetryCount          int        `json:"retryCount"`
	LastError           *string    `json:"lastError"`
	UpdatedAt           time.Time  `json:"updatedAt"`
} //@name MoexSyncStateResponse

type MoexCoverageResponse struct {
	Dataset    string    `json:"dataset"`
	EntityKey  string    `json:"entityKey"`
	FromDate   time.Time `json:"fromDate"`
	ToDate     time.Time `json:"toDate"`
	IsComplete bool      `json:"isComplete"`
	UpdatedAt  time.Time `json:"updatedAt"`
} //@name MoexCoverageResponse

type MoexSyncRunResponse struct {
	RunID         string     `json:"runId"`
	WorkflowID    *string    `json:"workflowId"`
	WorkflowRunID *string    `json:"workflowRunId"`
	Dataset       string     `json:"dataset"`
	EntityKey     string     `json:"entityKey"`
	Status        string     `json:"status"`
	StartedAt     time.Time  `json:"startedAt"`
	FinishedAt    *time.Time `json:"finishedAt"`
	FetchedRows   int        `json:"fetchedRows"`
	UpsertedRows  int        `json:"upsertedRows"`
	ErrorText     *string    `json:"errorText"`
	Details       *string    `json:"details"`
} //@name MoexSyncRunResponse

func NewMoexSyncStateResponses(rows []models.MoexSyncStateRow) []MoexSyncStateResponse {
	result := make([]MoexSyncStateResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, MoexSyncStateResponse{
			Dataset:             row.Dataset,
			EntityKey:           row.EntityKey,
			CheckedThroughDate:  row.CheckedThroughDate,
			ImmutableBeforeDate: row.ImmutableBeforeDate,
			MutableSinceDate:    row.MutableSinceDate,
			Status:              row.Status,
			LastSuccessAt:       row.LastSuccessAt,
			LastAttemptAt:       row.LastAttemptAt,
			RetryCount:          row.RetryCount,
			LastError:           row.LastError,
			UpdatedAt:           row.UpdatedAt,
		})
	}
	return result
}

func NewMoexCoverageResponses(rows []models.MoexCoverageRow) []MoexCoverageResponse {
	result := make([]MoexCoverageResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, MoexCoverageResponse{
			Dataset:    row.Dataset,
			EntityKey:  row.EntityKey,
			FromDate:   row.FromDate,
			ToDate:     row.ToDate,
			IsComplete: row.IsComplete,
			UpdatedAt:  row.UpdatedAt,
		})
	}
	return result
}

func NewMoexSyncRunResponses(rows []models.MoexSyncRunRow) []MoexSyncRunResponse {
	result := make([]MoexSyncRunResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, MoexSyncRunResponse{
			RunID:         row.RunID,
			WorkflowID:    row.WorkflowID,
			WorkflowRunID: row.WorkflowRunID,
			Dataset:       row.Dataset,
			EntityKey:     row.EntityKey,
			Status:        row.Status,
			StartedAt:     row.StartedAt,
			FinishedAt:    row.FinishedAt,
			FetchedRows:   row.FetchedRows,
			UpsertedRows:  row.UpsertedRows,
			ErrorText:     row.ErrorText,
			Details:       row.Details,
		})
	}
	return result
}
