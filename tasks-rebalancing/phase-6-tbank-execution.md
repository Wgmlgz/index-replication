# Phase 6: T-Bank Execution

## Goal
Add `tbank` support in controlled stages, starting with manual tracking and only then enabling automatic execution after real broker trading support is ready.

## Why This Phase Exists
`tbank` is the highest-risk provider in this feature set because it introduces broker-side order submission, reconciliation, and safety concerns. The current codebase does not yet have a full rebalance-ready trading surface for T-Bank, so this phase must be treated as provider expansion, not just “enable what already exists”.

## What Should Already Exist When You Start
Expected repo state before this phase:
- rebalance planning, lifecycle, and timeline already work
- manual progress tracking already works
- automatic orchestration has already been proven on `virtual`

If automatic orchestration is not already stable on `virtual`, do not start `tbank` automatic execution yet.

## Relevant Existing Code
Read these areas first:
- tbank provider: [api/internal/portfolio/tbank_provider.go](/Users/wgmlgz/index-replication/api/internal/portfolio/tbank_provider.go)
- tbank service/account/order code: [api/internal/tbank/service.go](/Users/wgmlgz/index-replication/api/internal/tbank/service.go), [api/internal/tbank/account.go](/Users/wgmlgz/index-replication/api/internal/tbank/account.go)
- existing T-Bank endpoints and status/config UI
- rebalance execution orchestration added in earlier phases

## Working System After This Phase
- Manual T-Bank rebalance tracking works.
- Automatic T-Bank rebalance is available only after broker-side buy/sell support and safety guardrails are implemented.

## Main Tasks
### 1. Deliver T-Bank manual support first
Context:
This reduces risk by reusing the manual tracking model before automatic broker execution is introduced.

Task:
Ensure T-Bank runs can:
- be planned
- be approved
- enter manual tracking mode
- attach broker operations to planned items

### 2. Add missing T-Bank trade primitives
Context:
Current code supports sandbox top-up and test buy only. That is not enough for real automatic rebalance execution.

Task:
Add the missing capabilities needed for real automatic rebalance support, including:
- generic buy order submission
- generic sell order submission
- order reference persistence
- order status/reconciliation reads

### 3. Add sandbox-only guardrails first
Context:
This phase should not accidentally create a path toward uncontrolled production trading.

Task:
Before any automatic T-Bank execution is enabled, add:
- sandbox-only gating
- confirmation enforcement
- order count / exposure limits
- clear feature flag or provider gating

### 4. Implement T-Bank automatic execution
Context:
Once the missing trading primitives and guardrails exist, the generic automatic execution model from `virtual` can be adapted for broker-backed orders.

Task:
Translate planned items into broker orders and persist:
- order refs
- item progress
- fill/reconciliation state
- failures and retries

### 5. Reconcile planned vs actual outcomes
Task:
Handle broker realities such as:
- partial fills
- rejects
- stale prices
- lot constraints
- not enough cash

### 6. Finalize UI for broker execution
Task:
Show:
- order lifecycle
- partial fill state
- reconciliation summary
- safety warnings

## Tests
### Backend
Add tests for:
- manual T-Bank tracking flow
- sandbox gating rules
- buy and sell order request mapping
- broker error handling
- partial fill reconciliation
- retry and duplicate prevention
- final rebalance completion rules

Add integration-style tests around T-Bank service wrappers where practical.

### Frontend
Add tests for:
- broker execution state rendering
- safety warning rendering
- partial fill and failure states

## Acceptance Criteria
- T-Bank manual rebalance tracking is reliable before automatic execution is enabled.
- Automatic T-Bank execution is sandbox-gated and guarded.
- Broker order lifecycle is visible from the app.
- Production execution remains disabled until explicitly approved later.

## Handoff Notes For Future Work
When this phase is complete, future developers should be able to assume:
- the rebalance engine supports both local and broker-backed providers
- T-Bank execution risks are constrained by explicit safety gates
- any future live-trading rollout would be a separate product and risk decision, not a hidden side effect of this phase

## Out Of Scope
- live production brokerage rollout
