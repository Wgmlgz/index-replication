# Phase 4: Manual Rebalancing Workflow

## Goal
Deliver a full manual workflow where the system plans the rebalance, the user executes trades manually, and the app tracks progress by attaching operations to the run.

## Why This Phase Exists
Manual mode provides real user value before automatic execution is ready. It also validates the rebalance domain model, progress tracking, and operation attachment rules without introducing broker-order submission complexity yet.

## What Should Already Exist When You Start
Expected repo state before this phase:
- rebalance drafts and lifecycle already exist
- approval already works
- operations feed already supports rebalance-aware timeline rendering
- rebalance detail UI already exists

If the operations feed is still raw provider-only data, Phase 3 is incomplete.

## Relevant Existing Code
Read these areas first:
- rebalance run/item/link models from previous phases
- provider operation endpoints and DTOs: [api/internal/handlers/portfolio.go](/Users/wgmlgz/index-replication/api/internal/handlers/portfolio.go), [api/internal/api/dto/portfolio.go](/Users/wgmlgz/index-replication/api/internal/api/dto/portfolio.go)
- virtual transaction behavior: [api/internal/portfolio/virtual_provider.go](/Users/wgmlgz/index-replication/api/internal/portfolio/virtual_provider.go)
- tbank operation mapping: [api/internal/portfolio/tbank_provider.go](/Users/wgmlgz/index-replication/api/internal/portfolio/tbank_provider.go), [api/internal/tbank/account.go](/Users/wgmlgz/index-replication/api/internal/tbank/account.go)
- portfolio timeline/detail UI from previous phases

## Working System After This Phase
- User can create and approve a manual rebalance.
- User can see what to buy/sell.
- System tracks progress as provider operations appear.
- Manual rebalancing is usable end-to-end even before automatic execution exists.

## Main Tasks
### 1. Add manual-mode lifecycle behavior
Context:
Approved manual runs should not enter an execution queue. They should enter a state where tracking can begin immediately.

Task:
After approval, manual runs should move into a tracking-ready state rather than execution queueing.

### 2. Define operation attachment rules
Context:
This is the main behavioral risk of the phase. Linking should be useful but conservative. It is better to leave an item unmatched than to match the wrong broker/virtual operation.

Task:
Support linking operations to rebalance runs/items using:
- explicit local link creation where possible
- run start/end timestamps
- instrument matching
- quantity/side heuristics when needed

Keep matching rules conservative and auditable.

### 3. Implement execution-link updates
Context:
Progress needs to be durable and inspectable, not recomputed only in the UI.

Task:
Persist progress at both levels:
- per linked provider operation
- per rebalance item status
- run-level aggregate progress

### 4. Add progress refresh/reconciliation actions
Context:
Manual workflows need a way to rescan the world after the user trades outside the rebalance page.

Task:
Support operations such as:
- refresh tracking
- recalculate progress
- mark run complete when fully matched
- leave partially matched runs visible

### 5. Add manual workflow UX
Task:
Show:
- planned actions
- current progress
- matched operations
- unmatched items
- completed / partial / failed status summary

### 6. Add backdated support for virtual/manual testing
Context:
The virtual provider is used for testing, so manual workflows must support past-date scenarios.

Task:
Allow the user to create manual rebalance runs against past dates for the `virtual` provider and verify tracking against past-dated transactions.

## Frontend Tasks
### 1. Manual rebalance detail UX
Task:
Render clear sections for:
- plan summary
- action list
- confirmation state
- tracking progress
- linked operations

### 2. Tracking controls
Task:
Add simple controls to:
- refresh progress
- inspect unmatched items
- inspect linked operations

## Tests
### Backend
Add service tests for:
- manual run state transitions
- explicit operation linking
- inferred operation linking by window + instrument
- partial completion behavior
- duplicate-link prevention

Add provider-focused tests for:
- virtual backdated tracking
- tbank operation enrichment compatibility in manual mode

Add API tests for:
- progress refresh endpoints
- manual run detail with linked operations

### Frontend
Add tests for:
- progress state rendering
- linked operation grouping in rebalance detail
- partial completion and unmatched item states

## Acceptance Criteria
- Manual rebalance can be completed without automatic trading.
- Progress is visible and persisted.
- Backdated virtual manual testing works.
- Users can inspect exactly which operations were attached to a run.

## Handoff Notes For Next Developer
When this phase is complete, the next developer should be able to assume:
- manual mode is already useful in production-like workflows
- execution links and progress tracking already exist
- the same run/item/link model can now be reused for automatic execution

## Out Of Scope
- automatic trade submission
