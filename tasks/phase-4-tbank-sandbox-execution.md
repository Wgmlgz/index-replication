# Phase 4: T-Bank Sandbox Execution

## Goal
Execute replication rebalance plans via T-Bank sandbox with strong safety controls.

## Core Tasks
1. Define sandbox execution safety policy and approval steps.
2. Add provider-gated execution support for T-Bank sandbox profiles.
3. Integrate plan items with T-Bank sandbox order workflow.
4. Persist broker-side order references and reconciliation state.
5. Add execution guardrails (order limits, exposure limits, confirmation checks).
6. Add reconciliation flow for planned vs filled outcomes.
7. Add UI for sandbox execution confirmation and live status.
8. Add audit logging for broker interaction and reconciliation events.
9. Add automated tests for sandbox execution and reconciliation.
10. Document sandbox operations, failure handling, and rollout checklist.

## Deliverables
1. Rebalance plans can execute in T-Bank sandbox only.
2. Users can track broker order lifecycle from the app.
3. Reconciled post-execution replication metrics are available.
4. Sandbox runbook and rollout checklist are published.

## Exit Criteria
1. Production execution remains disabled.
2. Safety guardrails are enforced before order submission.
3. Tests cover broker errors, partial fills, and retries.
