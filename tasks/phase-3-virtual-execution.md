# Phase 3: Virtual Execution

## Goal
Execute approved rebalance plans in virtual portfolios and measure post-trade drift.

## Core Tasks
1. Define execution workflow and status lifecycle for virtual execution.
2. Add execution endpoint(s) for rebalance plans on virtual portfolios.
3. Integrate plan-item execution with virtual provider actions.
4. Persist execution outcomes and error states per item.
5. Add post-execution replication status refresh.
6. Add rollback/retry policy for partial failures.
7. Add UI controls for execute, progress, and result inspection.
8. Add audit logging for execution attempts and outcomes.
9. Add automated tests for full virtual execution flow.
10. Document virtual execution behavior and operational guidance.

## Deliverables
1. Approved rebalance plans can be executed on virtual portfolios.
2. Users can see execution progress and final result state.
3. Post-trade drift metrics are available.
4. Execution and audit history is queryable.

## Exit Criteria
1. Execution is blocked for non-virtual providers.
2. Partial failure handling is visible and recoverable.
3. Tests validate idempotency and status transitions.
