# Rebalancing Delivery Plan

This folder contains a phase-based implementation plan for actual portfolio rebalancing.

The docs are written for handoff. A developer should be able to pick up any one phase without having worked on the previous phase, as long as the previous phase has already been delivered.

## Product Direction Fixed By These Docs
The following decisions are assumed unless product or architecture direction changes later:
- rebalancing is a first-class persisted domain, not just a provider-specific side effect
- rebalance planning is implemented as a pure algorithm layer with pluggable modes
- confirmation is optional but defaults to required
- confirmation can happen from website or Telegram
- rebalancing supports both `manual` and `automatic` execution modes
- `GET /me/portfolios/:id/operations` becomes the single paginated timeline feed in practice
- `GET /me/portfolios/:id/rebalances` is used for rebalance run list/detail and chart markers
- `virtual` is the first provider for full automatic execution
- `tbank` starts with planning/manual tracking before automatic execution

## Why The Work Is Split This Way
The full feature set touches:
- DB persistence
- planning algorithms
- lifecycle management
- Telegram and website confirmation flows
- portfolio operations feed contracts
- portfolio UI
- background execution and crash recovery
- provider-specific execution logic

Delivering all of that in one change would be too risky. The phases below are intended to keep the system usable after each milestone and to make regression checking realistic.

## Repo Context For New Developers
If you are joining at an arbitrary phase, read these first:
- [README.md](/Users/wgmlgz/index-replication/README.md)
- [api/README.md](/Users/wgmlgz/index-replication/api/README.md)
- [web/README.md](/Users/wgmlgz/index-replication/web/README.md)

Then inspect these existing areas because they are the main extension points:
- portfolio provider contract: [api/internal/portfolio/provider.go](/Users/wgmlgz/index-replication/api/internal/portfolio/provider.go)
- portfolio service and endpoints: [api/internal/portfolio/service.go](/Users/wgmlgz/index-replication/api/internal/handlers/portfolio.go)
- replication config model and repository: [api/internal/models/portfolio_replication_config.go](/Users/wgmlgz/index-replication/api/internal/repository/portfolio_replication_configs.go)
- virtual transaction storage and provider behavior: [api/internal/models/virtual_portfolio_transaction.go](/Users/wgmlgz/index-replication/api/internal/portfolio/virtual_provider.go)
- tbank provider and service: [api/internal/portfolio/tbank_provider.go](/Users/wgmlgz/index-replication/api/internal/tbank)
- portfolio overview UI and operations table: [web/src/app/portfolio/overview/page.tsx](/Users/wgmlgz/index-replication/web/src/app/portfolio/overview/page.tsx) and [web/src/app/portfolio/components/portfolio-operations-table.tsx](/Users/wgmlgz/index-replication/web/src/app/portfolio/components/portfolio-operations-table.tsx)
- price chart rendering: [web/src/components/charts-new/visualization/price-visualization.tsx](/Users/wgmlgz/index-replication/web/src/components/charts-new/visualization/price-visualization.tsx)

## Suggested Delivery Order
1. [phase-1-foundation-and-planning.md](/Users/wgmlgz/index-replication/tasks-rebalancing/phase-1-foundation-and-planning.md)
2. [phase-2-confirmation-and-run-lifecycle.md](/Users/wgmlgz/index-replication/tasks-rebalancing/phase-2-confirmation-and-run-lifecycle.md)
3. [phase-3-operations-feed-and-ui-foundation.md](/Users/wgmlgz/index-replication/tasks-rebalancing/phase-3-operations-feed-and-ui-foundation.md)
4. [phase-4-manual-rebalancing-workflow.md](/Users/wgmlgz/index-replication/tasks-rebalancing/phase-4-manual-rebalancing-workflow.md)
5. [phase-5-virtual-automatic-execution.md](/Users/wgmlgz/index-replication/tasks-rebalancing/phase-5-virtual-automatic-execution.md)
6. [phase-6-tbank-execution.md](/Users/wgmlgz/index-replication/tasks-rebalancing/phase-6-tbank-execution.md)

## Expected System State After Each Phase
- Phase 1: users can create persisted rebalance drafts with planned items only
- Phase 2: drafts can be approved or denied from website or Telegram
- Phase 3: the app can display a paginated mixed timeline and rebalance chart markers
- Phase 4: users can complete a manual rebalance workflow and track attached operations
- Phase 5: `virtual` automatic rebalancing works end-to-end and survives restart
- Phase 6: `tbank` support is added in controlled stages

## Handoff Expectations Between Phases
When finishing a phase, the developer should leave behind:
- updated migrations, models, services, handlers, and generated API client as needed
- tests that cover the new phase's happy path and the most likely failure cases
- short documentation updates if any README or endpoint behavior changed
- explicit notes in the PR or task tracker about deferred risks for the next phase

Each phase document includes:
- what should already exist when the phase starts
- what code areas are most relevant
- what not to change unless required
- the minimum tests needed before handoff
