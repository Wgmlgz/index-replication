# Phase 1: Read-Only Replication

## Goal
Enable benchmark configuration and portfolio-vs-index drift visibility without trade execution.

## Core Tasks
1. Align business rules for replication configuration (benchmark selection, replication mode, guardrails).
2. Define and approve Phase 1 scope and non-goals.
3. Add portfolio-level replication configuration management.
4. Provide portfolio replication status endpoint(s).
5. Add target-vs-actual composition comparison output.
6. Add top-level drift and tracking summary metrics.
7. Add a portfolio UI section/tab for replication settings and status.
8. Add access control and audit coverage for replication configuration updates.
9. Add automated tests for API contract and comparison calculations.
10. Add documentation for Phase 1 behavior and user flow.

## Deliverables
1. Replication config can be created/updated/read per portfolio.
2. Users can view benchmark composition vs portfolio composition.
3. Users can view drift summary metrics for current state.
4. Phase 1 documentation is available for product and engineering.

## Exit Criteria
1. End-to-end read-only replication flow works from UI.
2. No execution/rebalance actions are exposed.
3. Test suite covers happy path and common validation failures.
