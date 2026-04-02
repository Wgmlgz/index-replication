# Rebalancing Execution Pipeline

This document describes the end-to-end rebalance flow in general phases, from user request to provider-side execution.

## Scope

- Covers planning draft creation and execution orchestration.
- Covers execution for automatic providers (`virtual`, `tbank`).
- Uses API-level and workflow-level terminology (not provider-internal implementation details).

## Phases

1. Draft request
- User calls `POST /api/me/portfolios/:id/rebalances`.
- System validates profile/config and starts draft creation.

2. Snapshot assembly
- Load portfolio holdings, cash balances, replication config, benchmark composition, and instrument prices.
- Build normalized planner input.

3. Pure planning
- Execute planning algorithm (`full`) on normalized input.
- Produce planned items (`planned` / `unresolved`), warnings, and summary.

4. Draft persistence
- Persist run snapshot payloads (input/output/summary) with run status `draft`.
- Return draft detail to UI.

5. Execution start request
- User calls `POST /api/me/portfolios/:id/rebalances/:rebalanceId/execute`.
- System validates run state and queues Temporal workflow.
- API returns run status `queued`.

6. Temporal workflow run
- Workflow `rebalance.execute` runs activity `rebalance.execute_run_activity`.
- Activity marks run execution start and initializes in-memory execution state from planned items.

7. Item execution loop
- For each actionable item:
  - Resolve side and quantity.
  - Optionally resolve provider instrument (`tbank` path).
  - Execute provider action (`buy` / `sell`) via portfolio provider abstraction.
  - Record success/failure link and heartbeat progress.

8. Finalization
- Compute final run status:
  - `completed`
  - `partially_completed`
  - `failed`
- Mark run execution finished in DB with terminal status and `ended_at`.

9. Pollable execution status
- UI polls `GET /api/me/portfolios/:id/rebalances/:rebalanceId/execution`.
- While workflow is running, status is served from Temporal heartbeat.
- After workflow completion, status is served from workflow result.

## Run Status Lifecycle

```text
draft -> queued -> executing -> (completed | partially_completed | failed)
```

## Item Status Lifecycle

```text
planned -> executing -> (completed | failed)
unresolved (non-actionable from planning)
```

## High-Level Flow Diagram

```mermaid
flowchart TD
    A["User request: create rebalance draft"] --> B["Load snapshot"]
    B --> C["Run pure planner"]
    C --> D["Persist draft run (status=draft)"]
    D --> E["User request: execute draft"]
    E --> F["Start Temporal workflow (status=queued)"]
    F --> G["Activity ExecuteRun (status=executing)"]
    G --> H{For each item}
    H --> I["Resolve side and quantity"]
    I --> J{Provider needs resolution?}
    J -->|Yes| K["Resolve instrument"]
    J -->|No| L["Run buy/sell action"]
    K --> L
    L --> M{Action result}
    M -->|Success| N["Item completed + link"]
    M -->|Failure| O["Item failed + link"]
    N --> H
    O --> H
    H --> P["Finalize run status"]
    P --> Q["Mark ended_at in DB"]
    Q --> R["UI polls execution status"]
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User/UI
    participant API as API Handler/Service
    participant SNAP as Snapshot Loader
    participant PLAN as Planner
    participant DB as Rebalance Runs DB
    participant TMP as Temporal
    participant ACT as ExecuteRun Activity
    participant PRV as Provider (virtual/tbank)

    U->>API: POST /rebalances
    API->>SNAP: Build planner input
    SNAP-->>API: Snapshot input
    API->>PLAN: Plan(input)
    PLAN-->>API: Output(items/warnings/summary)
    API->>DB: Save run(status=draft, payloads)
    DB-->>API: Run ID
    API-->>U: Draft detail

    U->>API: POST execute rebalance run
    API->>TMP: Start workflow rebalance.execute
    TMP-->>API: accepted (queued)
    API-->>U: status=queued

    TMP->>ACT: ExecuteRun(params)
    ACT->>DB: Mark started_at
    loop each planned item
        ACT->>PRV: RunAction(buy/sell, action_id)
        PRV-->>ACT: success/failure
        ACT->>TMP: Heartbeat(progress/items/links)
    end
    ACT->>DB: Mark terminal status + ended_at
    ACT-->>TMP: Final result

    U->>API: GET rebalance execution status
    API->>TMP: Read heartbeat/result
    TMP-->>API: Execution state
    API-->>U: Progress + items + links
```

## Provider Notes

- Automatic execution is currently supported for `virtual` and `tbank`.
- Provider execution is called through the unified portfolio provider action interface.
- Execution uses deterministic `action_id` generation for retry/idempotency behavior.
