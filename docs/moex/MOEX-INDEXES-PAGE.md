# MOEX Indexes Page

This doc describes the MOEX indexes page UI, its components, and the supporting hooks.

**Overview**
- Page: `web/src/app/moex-indexes/page.tsx`
- Feature folder: `web/src/components/moex-indexes/`
- Data sources: `web/src/lib/moex-client.ts` and user settings via `web/src/lib/user-settings-client.ts`
- State orchestration: `web/src/components/moex-indexes/use-moex-indexes.ts`

**Entry Points**
- Page component mounts `MoexIndexesProvider` and renders `MoexIndexesContent`.
- The provider exposes a single context consumed by list and chart cards.

**Component Map**
- `MoexIndexesProvider` + `useMoexIndexesContext`: `web/src/components/moex-indexes/moex-indexes-context.tsx`
- List container: `web/src/components/moex-indexes/index-list-card.tsx`
- List filters: `web/src/components/moex-indexes/index-list-filters.tsx`
- List pagination: `web/src/components/moex-indexes/index-list-pagination.tsx`
- List section + item: `web/src/components/moex-indexes/index-list-section.tsx`, `web/src/components/moex-indexes/index-list-item.tsx`
- Chart container: `web/src/components/moex-indexes/index-chart-card.tsx`
- Chart renderer: `web/src/components/moex-indexes/index-chart.tsx`

**State and Hooks**
- Types live in `web/src/components/moex-indexes/use-moex-indexes.types.ts`.
- Utilities and constants live in `web/src/components/moex-indexes/use-moex-indexes.utils.ts`.

Hooks:
- `useMoexIndexes` orchestrates queries, selection, favorites, errors, and exposes derived state.
- `useMoexIndexCollections` loads index collections and memberships, builds grouping metadata, and prepares filter options.
- `useMoexIndexList` handles search, filters, sorting, grouping, pagination, and empty states.
- `useMoexIndexHistory` loads the 12-month history for the selected index and derives chart series and change metrics.

**Data Flow**
1. `useMoexIndexes` loads the base index list (`moexClient.getIndexes()`).
2. Collections and memberships are loaded to build grouping and filter options.
3. User favorites are loaded from user settings and stored as a set for fast lookup.
4. The selected index is resolved using explicit selection, then favorites fallback, then a default index.
5. History data for the selected index is fetched and mapped to chart data.

**Filtering, Sorting, Pagination**
- Search matches by `secid`, `shortName`, and `name`.
- Filters are multi-select for collection, currency, board, and calculation mode.
- Sorting options are defined in `SORT_OPTIONS` and applied in `useMoexIndexList`.
- Pagination is client-side. Filters or sorting reset the page to the first page.

**Favorites**
- Favorites are persisted via user settings and optimistically updated in the query cache.
- The list can be filtered to favorites only.

**Chart Data**
- History is fetched for the last 365 days.
- Chart points are normalized and ordered by date.
- Latest value, change, and change percent are computed for the header meta.

**Layout and Scrolling**
- The page uses a full-height layout and constrains overflow so only the list scrolls.
- The list content uses `ScrollArea` and `min-h-0` on containers to avoid page scroll.

**Extending the Page**
- Add a new filter: update `use-moex-indexes.utils.ts` (options), `use-moex-indexes.ts` (state), and `index-list-filters.tsx` (UI).
- Add a new sort option: update `SORT_OPTIONS` and `sortComparators` in `use-moex-indexes.utils.ts`.
- Add new metadata chips: update `index-chart-card.tsx` and ensure the data exists on `MoexIndex`.
