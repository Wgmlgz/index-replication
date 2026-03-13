# Phase 3: Operations Feed And UI Foundation

## Goal
Turn the operations endpoint into the single paginated timeline feed and update the UI to render rebalance runs together with provider operations.

## Why This Phase Exists
At scale, the frontend cannot reliably merge two independently paginated feeds into one timeline. This phase moves that responsibility into the backend by making the operations feed itself the paginated mixed timeline.

This phase also gives the UI a stable foundation before manual or automatic execution tracking gets more complex.

## What Should Already Exist When You Start
Expected repo state before this phase:
- rebalance runs exist and can be listed/read
- run lifecycle and confirmation already work
- run detail UI already exists

If there is still no rebalance list/detail API, Phase 1 is incomplete.
If run statuses are still unstable, Phase 2 is incomplete.

## Relevant Existing Code
Read these areas first:
- portfolio operations endpoint: [api/internal/handlers/portfolio.go](/Users/wgmlgz/index-replication/api/internal/handlers/portfolio.go)
- portfolio operation DTOs: [api/internal/api/dto/portfolio.go](/Users/wgmlgz/index-replication/api/internal/api/dto/portfolio.go)
- provider operation implementations: [api/internal/portfolio/virtual_provider.go](/Users/wgmlgz/index-replication/api/internal/portfolio/virtual_provider.go), [api/internal/portfolio/tbank_provider.go](/Users/wgmlgz/index-replication/api/internal/portfolio/tbank_provider.go)
- current operations UI: [web/src/app/portfolio/components/portfolio-operations-table.tsx](/Users/wgmlgz/index-replication/web/src/app/portfolio/components/portfolio-operations-table.tsx)
- price chart rendering: [web/src/components/charts-new/visualization/price-visualization.tsx](/Users/wgmlgz/index-replication/web/src/components/charts-new/visualization/price-visualization.tsx)

## Working System After This Phase
- `GET /operations` returns a paginated mixed feed.
- Feed includes rebalance header rows and linked operations.
- Frontend timeline/list works without trying to merge two separately paginated feeds.
- Chart markers can be drawn from `GET /rebalances`.

## Main Tasks
### 1. Extend operations endpoint contract
Context:
The old contract only knows about raw provider operations. The new UI needs first-class rebalance rows without inventing a separate timeline endpoint.

Task:
Add support for mixed feed items, for example:
- regular provider operation item
- synthetic rebalance run header item

Include enough metadata to group items:
- item kind
- rebalance run id
- rebalance item id when available
- run status/mode on header rows
- event timestamp used for sorting

### 2. Add backend feed assembly logic
Context:
This is the key backend task of the phase. The system needs one stable cursor-based stream even when a single day contains many operations.

Task:
Build one paginated stream by combining:
- provider operations
- rebalance run header rows
- local execution-link enrichment

Requirements:
- deterministic ordering
- stable cursor
- no duplicate header rows across pages
- efficient enough for large operation days

### 3. Add query/filter support
Context:
Operations feed should remain usable for both UI and debugging.

Task:
Support at minimum:
- cursor
- limit
- portfolio/profile id context
- optional date filters if needed for debugging and charting

### 4. Add rebalance link enrichment
Context:
Providers will not necessarily store rebalance references the same way, so the API needs a provider-agnostic enriched shape.

Task:
For operations that belong to a rebalance run, enrich response with:
- rebalance run id
- rebalance item id if known

This must work uniformly across providers even if storage differs.

### 5. Expose rebalances list for chart markers
Context:
Markers do not need a dedicated endpoint yet. Rebalance runs are already the authoritative source.

Task:
Use `GET /rebalances` as marker source.
No dedicated marker endpoint is needed in this phase.

## Frontend Tasks
### 1. Replace operations table with timeline/list UI
Context:
The current UI is a table optimized for raw operations only. Rebalance headers and grouping require a more list-like representation.

Task:
Rework current operations table into a list that can render:
- rebalance header row/card
- linked child transactions
- standalone transactions

### 2. Add pagination handling for mixed feed
Task:
Use the backend cursor directly.
Do not try to reconstruct ordering in the client from multiple endpoints.

### 3. Add chart marker rendering
Task:
Read rebalance runs and display markers/points on portfolio price chart.
Keep marker rendering simple in this phase.

### 4. Keep detail navigation clear
Task:
User should be able to open a rebalance detail page from the timeline.

## Tests
### Backend
Add feed assembly tests for:
- correct merge ordering
- header row insertion
- cursor stability
- page boundary behavior when a day has many operations
- linked and unlinked operations

Add API tests for:
- mixed feed shape
- rebalance metadata in operation items
- pagination over dense transaction ranges

### Frontend
Add tests for:
- mixed timeline rendering
- header + child grouping
- pagination/load-more behavior
- chart marker mapping from rebalance list

## Acceptance Criteria
- One paginated feed powers the timeline UI.
- Frontend no longer needs to merge paginated `/operations` and `/rebalances` into one ordered stream.
- Rebalance runs appear inside the operations list as first-class timeline items.
- Chart markers come from rebalance runs successfully.

## Handoff Notes For Next Developer
When this phase is complete, the next developer should be able to assume:
- the paginated operations feed already contains rebalance-aware timeline data
- UI rendering no longer depends on naive client-side feed merging
- linked operations can be shown in context once manual or automatic tracking is implemented

## Out Of Scope
- manual completion workflow
- automatic execution
