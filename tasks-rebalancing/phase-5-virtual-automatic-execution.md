# Phase 5: Virtual Automatic Execution

## Goal
Execute approved rebalance runs automatically for the `virtual` provider with durable progress, restart safety, and test-friendly backdated support.

## Why This Phase Exists
`virtual` is the safest place to prove automatic execution because transactions are local, deterministic, and already persisted by the app. This phase should validate the orchestration and recovery model before touching broker-backed automatic trading.

## What Should Already Exist When You Start
Expected repo state before this phase:
- planning exists
- lifecycle and confirmation exist
- operations feed and timeline UI exist
- manual linking/progress tracking exist
- virtual provider can already persist normal transactions with explicit execution timestamps

If the virtual provider cannot already create backdated transactions, stop and inspect the branch state.

## Relevant Existing Code
Read these areas first:
- virtual transaction model/repository: [api/internal/models/virtual_portfolio_transaction.go](/Users/wgmlgz/index-replication/api/internal/models/virtual_portfolio_transaction.go), [api/internal/repository/virtual_portfolio_transactions.go](/Users/wgmlgz/index-replication/api/internal/repository/virtual_portfolio_transactions.go)
- virtual provider action flow: [api/internal/portfolio/virtual_provider.go](/Users/wgmlgz/index-replication/api/internal/portfolio/virtual_provider.go)
- portfolio actions UI that already supports `executed_at`: [web/src/app/portfolio/components/portfolio-summary-actions/portfolio-trade-action.tsx](/Users/wgmlgz/index-replication/web/src/app/portfolio/components/portfolio-summary-actions/portfolio-trade-action.tsx), [web/src/app/portfolio/components/portfolio-summary-actions/portfolio-deposit-cash-action.tsx](/Users/wgmlgz/index-replication/web/src/app/portfolio/components/portfolio-summary-actions/portfolio-deposit-cash-action.tsx)
- any background-worker infrastructure already used in the API service if available

## Working System After This Phase
- Approved automatic virtual runs can execute end-to-end.
- Progress survives restart.
- User can track execution from the UI.
- Past-date execution remains possible for testing.

## Main Tasks
### 1. Add virtual execution service
Context:
This phase should not bypass the rebalance domain by directly writing “fire and forget” virtual transactions. Execution must be durable and traceable through run/item/link state.

Task:
Translate planned items into virtual provider transactions.
Use durable run/item state updates around every execution step.

### 2. Add automatic execution lifecycle
Context:
Automatic mode needs more granular statuses than manual mode because the system is now the actor performing changes.

Task:
Introduce statuses needed for automatic mode, for example:
- queued
- executing
- partially_completed
- completed
- failed

### 3. Make execution restart-safe
Context:
Crash recovery is one of the original requirements. This is the phase where that requirement becomes real.

Task:
On server restart, system must be able to:
- resume queued/executing runs
- avoid duplicate submissions
- reconcile already-created virtual transactions

### 4. Persist exact execution outputs
Task:
Store on execution links:
- resulting transaction id
- execution timestamp
- actual quantity/price/payment
- error payload when failed

### 5. Add execution worker/orchestrator
Context:
Execution should not happen inline inside API request handlers.

Task:
A background runner should process approved automatic virtual runs rather than blocking API requests.

### 6. Add retry and failure policy
Task:
Handle:
- item-level failure
- run-level failure
- safe retry without duplicate transactions
- visible failure reason

### 7. Add UI for automatic progress
Task:
Show:
- queued/executing/completed states
- per-item progress
- virtual transaction links
- retry when supported

## Tests
### Backend
Add execution tests for:
- happy path automatic virtual rebalance
- partial failure
- idempotent retry
- restart recovery/resume
- backdated execution path
- execution link persistence

Add repository/service tests for:
- queued run pickup
- duplicate worker pickup prevention
- consistent final status updates

### Frontend
Add tests for:
- automatic progress rendering
- retry/error state rendering
- completed run detail rendering

## Acceptance Criteria
- Automatic rebalance works end-to-end for `virtual` portfolios.
- Restart does not lose run progress or duplicate transactions.
- User can inspect per-item and per-transaction results.

## Handoff Notes For Next Developer
When this phase is complete, the next developer should be able to assume:
- the generic automatic execution orchestration model is proven on `virtual`
- restart-safe state handling already exists
- provider-specific broker work can now focus on tbank constraints rather than re-inventing orchestration

## Out Of Scope
- tbank automatic execution
