# Phase 1: Foundation And Planning

## Goal
Introduce a persistent rebalance domain and a pure planning engine so the system can create deterministic rebalance drafts without executing anything.

## Why This Phase Exists
The current app has replication config but not real rebalance persistence or planning as a first-class feature. This phase creates the durable data model and the pure calculation layer that every later phase depends on.

Without this phase, confirmation, execution, timeline rendering, and crash recovery all have nowhere reliable to attach.

## What Should Already Exist When You Start
Expected repo state before this phase:
- portfolio profiles and provider abstraction already work
- replication config CRUD already exists
- benchmark composition and portfolio composition can already be read from existing APIs
- `virtual` and `tbank` providers can expose operations/history/composition

If any of the above is missing, stop and confirm whether the branch is incomplete.

## Relevant Existing Code
Start here before making design changes:
- provider abstraction: [api/internal/portfolio/provider.go](/Users/wgmlgz/index-replication/api/internal/portfolio/provider.go)
- portfolio service: [api/internal/portfolio/service.go](/Users/wgmlgz/index-replication/api/internal/portfolio/service.go)
- portfolio endpoints: [api/internal/handlers/portfolio.go](/Users/wgmlgz/index-replication/api/internal/handlers/portfolio.go)
- replication config model/repo: [api/internal/models/portfolio_replication_config.go](/Users/wgmlgz/index-replication/api/internal/models/portfolio_replication_config.go), [api/internal/repository/portfolio_replication_configs.go](/Users/wgmlgz/index-replication/api/internal/repository/portfolio_replication_configs.go)
- MOEX composition reads: [api/internal/moex](/Users/wgmlgz/index-replication/api/internal/moex)
- portfolio UI entry points: [web/src/app/portfolio/overview/page.tsx](/Users/wgmlgz/index-replication/web/src/app/portfolio/overview/page.tsx), [web/src/app/portfolio/components/portfolio-replication-panel.tsx](/Users/wgmlgz/index-replication/web/src/app/portfolio/components/portfolio-replication-panel.tsx)

## Working System After This Phase
- User can create a rebalance draft for a portfolio.
- Draft is persisted in DB and survives restart.
- Draft contains planned items and summary data.
- Draft can be listed and viewed in detail.
- No execution is performed yet.

## Main Tasks
### 1. Define rebalance persistence model
Context:
Later phases need durable run state, durable plan items, and a place to store operation links and confirmations. Even if linking and confirmation are not fully used yet, the schema should make those later phases straightforward.

Task:
Create backend models, migrations, and repositories for:
- rebalance runs
- rebalance items
- execution links placeholder table
- confirmation records placeholder table

Minimum run data:
- portfolio/profile reference
- provider
- benchmark secid snapshot
- replication mode snapshot
- planning params snapshot
- execution mode (`manual` or `automatic`)
- confirmation required flag
- status
- as-of date
- start/end timestamps
- created/updated timestamps

Minimum item data:
- rebalance run reference
- ticker/instrument id
- buy or sell side
- current quantity
- target quantity
- delta quantity
- current weight
- target weight
- reference price
- planned amount
- status
- metadata JSON

What to keep in mind:
- run records must survive crashes and support future restarts
- snapshot data should be copied into the run, not read dynamically from current config later
- schema should not be virtual-only

### 2. Introduce pure planning module
Context:
The user explicitly wants planning modes to remain easy to extend and change later. That means the calculation logic should not live inside handlers, providers, or repositories.

Task:
Create a dedicated package for planning with:
- planner service
- algorithm registry
- algorithm interface
- typed planning input/output structs

Rules for this module:
- pure algorithm code only
- no DB writes inside algorithms
- no provider trade execution inside algorithms
- provider snapshots loaded before algorithm invocation

What to keep in mind:
- separate “load data” from “compute result”
- keep mode dispatch explicit via registry / interface
- aim for narrow, testable input structs

### 3. Implement first planning algorithms
Context:
Current replication config already has `mode_key` and `mode_params`. This phase is where those become real planning modes instead of passive settings.

Task:
Implement the first supported modes from current replication config.
At minimum:
- `full`
- `sampled`

Responsibilities:
- map current portfolio snapshot to benchmark target snapshot
- calculate desired target quantities/weights
- produce actionable item list
- preserve unresolved items when data is missing

What to keep in mind:
- deterministic output matters more than optimization in this phase
- unresolved instruments should be represented explicitly, not silently dropped
- zero-delta filtering rules should be consistent and tested

### 4. Build snapshot loading service
Context:
Algorithms need normalized inputs, but the source data comes from provider-specific portfolio reads and benchmark composition data. This task isolates that complexity.

Task:
Add a service that prepares planning inputs by loading:
- current portfolio composition as of date
- benchmark composition as of date
- portfolio cash / summary data needed for constraints
- replication config snapshot

This service should hide provider-specific reads from the pure algorithms.

What to keep in mind:
- this is where provider-specific and benchmark-specific fetch logic belongs
- as-of date behavior must be explicit because later phases rely on backdated virtual testing

### 5. Add rebalance creation and read APIs
Context:
The system should become usable after this phase, so users need a way to create drafts and inspect them.

Task:
Add endpoints for:
- create rebalance draft
- list rebalances
- get rebalance detail

Creation should:
- validate provider/profile/config
- resolve snapshots
- run selected algorithm
- persist run and items in one transaction
- return created draft

What to keep in mind:
- do not trigger execution, confirmation, or background jobs here
- response should be useful enough for a first rebalance detail screen

### 6. Add DTOs and OpenAPI coverage
Context:
The frontend uses generated clients, so unfinished DTO work will create drift immediately.

Task:
Expose rebalance run/item DTOs and keep generated frontend client in sync.

What to keep in mind:
- avoid leaking internal DB-only fields
- keep response naming consistent with existing portfolio APIs

### 7. Add audit logging
Context:
Planning is a meaningful user action and should be traceable from day one.

Task:
Log at minimum:
- rebalance draft created
- planning failed

## Frontend Tasks
### 1. Add rebalance draft creation entry point
Context:
The goal is not a full polished execution UI yet. This phase only needs a simple but usable creation path.

Task:
Start simple:
- trigger from replication area
- choose execution mode
- choose as-of date when supported
- create draft and redirect to details

### 2. Add rebalance list/detail pages or panels
Task:
Show:
- run summary
- status
- planned items
- warnings/unresolved items

Keep the UI read-only in this phase.

## Tests
### Backend
Add repository tests for:
- migrations create required tables
- run/item persistence and retrieval
- cascade/delete behavior where applicable

Add planner tests for:
- deterministic output for same input
- `full` mode basic scenario
- `sampled` mode basic scenario
- missing benchmark data / unresolved instrument cases
- rounding and zero-delta filtering rules

Add API tests for:
- create draft success
- invalid profile or config
- draft detail/list contract

## Acceptance Criteria
- Rebalance draft can be created and reloaded after restart.
- Planning logic is isolated behind an algorithm registry.
- Same input produces the same draft items.
- No provider execution occurs.

## Handoff Notes For Next Developer
When this phase is complete, the next developer should be able to assume:
- rebalance runs/items exist as durable records
- planning modes are invoked through a pure abstraction
- there is a stable API contract for rebalance draft create/list/detail
- execution and confirmation are still intentionally absent

## Out Of Scope
- confirmation
- operation linking
- manual tracking
- automatic execution
- timeline/list merge
