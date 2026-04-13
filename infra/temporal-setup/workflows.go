package main

const (
	metaRefreshWorkflowName               = "moex.meta_refresh"
	dailySyncWorkflowName                 = "moex.daily_sync"
	rebalanceScheduleDispatchWorkflowName = "rebalance.schedule.dispatch"
)

type metaRefreshParams struct {
	Mode                   string `json:"mode"`
	EnableSearchAttributes bool   `json:"enableSearchAttributes,omitempty"`
}

type dailySyncParams struct {
	Mode                   string   `json:"mode"`
	From                   string   `json:"from,omitempty"`
	Till                   string   `json:"till,omitempty"`
	ChunkMonths            int      `json:"chunkMonths,omitempty"`
	ChunkCursorTill        string   `json:"chunkCursorTill,omitempty"`
	Parallelism            int      `json:"parallelism,omitempty"`
	RetrySecids            []string `json:"retrySecids,omitempty"`
	RetryPass              int      `json:"retryPass,omitempty"`
	EnableSearchAttributes bool     `json:"enableSearchAttributes,omitempty"`
}

type rebalanceScheduleDispatchParams struct {
	WindowSeconds int `json:"windowSeconds,omitempty"`
}
