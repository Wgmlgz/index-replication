# Rebalancing Execution Pipeline

This document describes the end-to-end rebalance flow in general phases, from user request to provider-side execution.

## Scope

- Covers planning draft creation and execution orchestration.
- Covers execution for automatic providers (`virtual`, `tbank`).
- Uses API-level and workflow-level terminology (not provider-internal implementation details).

## Phases

1. Draft request
- User calls `POST /api/me/portfolios/:id/rebalances`.
- System validates profile/config, creates run with status `planning_queued`, starts Temporal planning workflow (`rebalance.plan`), and returns `202 Accepted`.

2. Temporal planning workflow run
- Workflow `rebalance.plan` runs activity `rebalance.plan_run_activity`.
- Activity transitions run status to `planning`.

3. Snapshot assembly
- Worker loads portfolio holdings, cash balances, replication config, benchmark composition, and instrument prices.
- Worker resolves/fills instrument IDs at snapshot build time (provider-aware).
- Worker builds normalized planner input.

4. Pure planning and draft persistence
- Worker executes planning algorithm (`full`) on normalized input.
- Worker persists run payloads (input/output/summary/warnings) and transitions:
  - to `draft` on success
  - to `planning_failed` on planning failure

5. Execution start request
- User calls `POST /api/me/portfolios/:id/rebalances/:rebalanceId/execute`.
- System validates run state (`draft` or `failed`) and queues Temporal workflow.
- API returns run status `queued`.

6. Temporal execution workflow run
- Workflow `rebalance.execute` runs activity `rebalance.execute_run_activity`.
- Activity marks run execution start and initializes in-memory execution state from planned items.

7. Item execution loop
- For each actionable item:
  - Resolve side and quantity.
  - Validate `instrument_id` is present.
  - Execute provider action (`buy` / `sell`) via portfolio provider abstraction.
  - Record success/failure link and heartbeat progress.

8. Finalization
- Compute final run status:
  - `completed`
  - `partially_completed`
  - `failed`
- Mark run execution finished in DB with terminal status and `ended_at`.

9. Pollable run status
- UI polls `GET /api/me/portfolios/:id/rebalances/:rebalanceId/status`.
- While workflow is running, status is served from Temporal heartbeat.
- After workflow completion, status is served from workflow result.
- Status payload includes coarse run `status` plus stage telemetry (`stage_code`, `stage_message`,
  `stage_index`, `stage_total`) so UI can display what the planner/executor is currently doing.

## Run Status Lifecycle

```text
planning_queued -> planning -> (draft | planning_failed)
draft|failed -> queued -> executing -> (completed | partially_completed | failed)
```

## Item Status Lifecycle

```text
planned -> executing -> (completed | failed)
unresolved (non-actionable from planning)
planned with missing instrument_id -> failed
```

## High-Level Flow Diagram

```mermaid
flowchart TD
    A["User request: create rebalance draft"] --> B["Create run (status=planning_queued) + start rebalance.plan"]
    B --> C["Activity PlanRun (status=planning)"]
    C --> D["Load snapshot"]
    D --> E["Run pure planner + persist payloads"]
    E --> F["Run status: draft or planning_failed"]
    F --> G["User request: execute draft"]
    G --> H["Start rebalance.execute (status=queued)"]
    H --> I["Activity ExecuteRun (status=executing)"]
    I --> J{For each item}
    J --> K["Resolve side and quantity"]
    K --> L{"instrument_id present?"}
    L -->|No| P["Item failed + link"]
    L -->|Yes| M["Run buy/sell action"]
    M --> N{Action result}
    N -->|Success| O["Item completed + link"]
    N -->|Failure| P["Item failed + link"]
    O --> J
    P --> J
    J --> Q["Finalize run status"]
    Q --> R["Mark ended_at in DB"]
    R --> S["UI polls run status"]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User/UI
    participant API as API Handler/Service
    participant DB as Rebalance Runs DB
    participant TMP as Temporal
    participant PACT as PlanRun Activity
    participant SNAP as Snapshot Loader
    participant PLAN as Planner
    participant ACT as ExecuteRun Activity
    participant PRV as Provider (virtual/tbank)

    U->>API: POST /rebalances
    API->>DB: Save run(status=planning_queued)
    API->>TMP: Start workflow rebalance.plan
    TMP-->>API: accepted
    API-->>U: 202 + run(status=planning_queued)

    TMP->>PACT: PlanRun(params)
    PACT->>DB: Mark status=planning
    PACT->>SNAP: Build planner input
    SNAP-->>PACT: Snapshot input
    PACT->>PLAN: Plan(input)
    PLAN-->>PACT: Output(items/warnings/summary)
    PACT->>DB: Save payloads + status=draft (or planning_failed)

    U->>API: POST execute rebalance run
    API->>TMP: Start workflow rebalance.execute
    TMP-->>API: accepted (queued)
    API-->>U: status=queued

    TMP->>ACT: ExecuteRun(params)
    ACT->>DB: Mark started_at
    loop each planned item
        ACT->>ACT: Validate instrument_id
        ACT->>PRV: RunAction(buy/sell, action_id)
        PRV-->>ACT: success/failure
        ACT->>TMP: Heartbeat(progress/items/links)
    end
    ACT->>DB: Mark terminal status + ended_at
    ACT-->>TMP: Final result

    U->>API: GET rebalance status
    API->>TMP: Read heartbeat/result
    TMP-->>API: Execution state
    API-->>U: Progress + items + links
```

## Provider Notes

- Automatic execution is currently supported for `virtual` and `tbank`.
- Provider execution is called through the unified portfolio provider action interface.
- Execution uses deterministic `action_id` generation for retry/idempotency behavior.
- Execution does not perform runtime instrument resolution; missing `instrument_id` is treated as an item execution error.
