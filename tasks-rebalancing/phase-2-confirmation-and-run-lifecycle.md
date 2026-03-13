# Phase 2: Confirmation And Run Lifecycle

## Goal
Add persisted run lifecycle management and optional confirmation through website or Telegram.

## Why This Phase Exists
A rebalance draft is not enough for a real workflow. The system needs durable approval state so that later execution and tracking behavior is safe, auditable, and restart-friendly.

This phase should still avoid real execution. It focuses only on lifecycle and approval.

## What Should Already Exist When You Start
Expected repo state before this phase:
- rebalance runs and items exist
- create/list/detail rebalance APIs exist
- planning produces persisted drafts
- frontend can show rebalance detail

If these do not exist yet, Phase 1 is incomplete.

## Relevant Existing Code
Read these areas first:
- rebalance models/repositories added in Phase 1
- portfolio handlers/services from existing code: [api/internal/handlers/portfolio.go](/Users/wgmlgz/index-replication/api/internal/handlers/portfolio.go), [api/internal/portfolio/service.go](/Users/wgmlgz/index-replication/api/internal/portfolio/service.go)
- Telegram integration: [api/internal/telegram](/Users/wgmlgz/index-replication/api/internal/telegram)
- Telegram verification docs: [docs/TELEGRAM-VERIFICATION.md](/Users/wgmlgz/index-replication/docs/TELEGRAM-VERIFICATION.md)

## Working System After This Phase
- Draft runs can move through approval states.
- Website confirmation works.
- Telegram confirmation works for connected users.
- Rebalance run status is durable and auditable.

## Main Tasks
### 1. Finalize lifecycle state machine
Context:
Execution and tracking phases will depend on consistent status behavior. State transitions should be explicit now instead of spreading conditional logic everywhere later.

Task:
Define allowed statuses and transitions for runs, for example:
- `draft`
- `awaiting_confirmation`
- `denied`
- `approved`
- `queued`
- `executing`
- `tracking`
- `completed`
- `failed`
- `cancelled`

Document which transitions are legal for:
- manual mode
- automatic mode
- confirmation-required vs confirmation-skipped

### 2. Implement confirmation persistence
Context:
Telegram and website confirmation must both write into the same durable state model.

Task:
Use the confirmation table introduced in Phase 1 for:
- pending confirmation request records
- selected channel (`website` or `telegram`)
- expiration data if needed
- resolved by / resolved at data
- approval or denial result

What to keep in mind:
- first completed resolution should win
- duplicate or stale resolution attempts should be safe

### 3. Add website confirmation endpoints
Context:
Website approval is the simpler channel and should be the baseline behavior.

Task:
Add endpoints for:
- confirm run
- deny run

Rules:
- idempotent behavior
- only first resolution wins
- invalid transitions are rejected cleanly

### 4. Add Telegram confirmation flow
Context:
Telegram is a first-class confirmation channel, not a later enhancement.

Task:
Reuse existing Telegram integration to:
- create/send rebalance confirmation prompt
- handle approve callback
- handle deny callback
- update confirmation row and run status

What to keep in mind:
- callback security and duplicate handling matter more than UI polish here
- disconnected Telegram users should fail gracefully and fall back to website

### 5. Add lifecycle service layer
Context:
Status changes should not be scattered across handlers or future executors.

Task:
Centralize status transitions in one place rather than letting handlers or providers change status directly.

### 6. Expand audit logging
Task:
Log at minimum:
- confirmation requested
- approved via website
- denied via website
- approved via Telegram
- denied via Telegram
- invalid confirmation attempt

## Frontend Tasks
### 1. Show lifecycle state on rebalance detail
Task:
Display:
- current status
- confirmation required or skipped
- confirmation channel
- approval/denial timestamps

### 2. Add website approval/denial actions
Task:
Expose approve/deny buttons when allowed.

### 3. Surface Telegram confirmation state
Task:
Show whether Telegram was used or is available as an option.

## Tests
### Backend
Add service tests for:
- valid transitions
- invalid transitions
- idempotent confirm/deny behavior
- confirmation-skipped runs

Add API tests for:
- website approve success
- website deny success
- repeated approval attempt
- approval by wrong user / invalid run

Add Telegram integration tests for:
- callback resolves correct run
- duplicate callback does not corrupt state
- disconnected Telegram user fallback behavior

### Frontend
Add tests for:
- status rendering per state
- approve/deny action visibility
- optimistic refresh/error states

## Acceptance Criteria
- Confirmation can be completed from website.
- Confirmation can be completed from Telegram when Telegram is connected.
- Run status survives restart and is updated exactly once.
- Status transitions are validated in one centralized service.

## Handoff Notes For Next Developer
When this phase is complete, the next developer should be able to assume:
- rebalance runs have stable lifecycle status semantics
- confirmation records exist and are queryable
- website and Telegram approval write into the same durable model
- execution still has not started yet

## Out Of Scope
- operations feed enrichment
- manual operation linking
- automatic execution
