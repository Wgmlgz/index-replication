# Phase 2: Rebalance Planning

## Goal
Generate and review rebalance plans from drift data without executing orders.

## Core Tasks
1. Define plan generation policy inputs (thresholds, turnover caps, exclusions, cash rules).
2. Add data model for rebalance plans and plan items.
3. Add plan generation endpoint(s) for on-demand preview.
4. Add plan retrieval/history endpoint(s).
5. Implement portfolio-to-target delta calculation for actionable plan lines.
6. Add unresolved-item handling for unmapped/unpriced instruments.
7. Add UI for rebalance plan preview and review.
8. Add audit logging for plan creation and user review actions.
9. Add automated tests for plan generation and constraints.
10. Document planning behavior, assumptions, and limitations.

## Deliverables
1. Users can generate rebalance plans from replication config.
2. Users can inspect plan items before execution.
3. Plan records are persisted and queryable.
4. Policy constraints are reflected in plan outputs.

## Exit Criteria
1. Plan generation is deterministic for same input state.
2. No live/sandbox orders are sent in this phase.
3. Tests cover normal and constrained planning scenarios.
