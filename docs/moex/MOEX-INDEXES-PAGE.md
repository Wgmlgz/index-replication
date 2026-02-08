# MOEX Indexes Page

This doc describes the MOEX indexes page UI, its components, and the supporting hooks.

**Overview**

- Page: `web/src/app/moex-indexes/page.tsx`
- Feature folder: `web/src/components/moex-indexes/` (split into `list/` and `detail/`)
- Data sources: `web/src/lib/moex-client.ts` and user settings via `web/src/lib/user-settings-client.ts`
- State orchestration: `web/src/components/moex-indexes/use-moex-indexes-data.ts` +
  `web/src/components/moex-indexes/list/use-moex-indexes-list-state.ts` +
  `web/src/components/moex-indexes/detail/use-moex-indexes-detail-state.ts`

**Entry Points**

- Page component mounts `MoexIndexesProvider` and renders `MoexIndexesContent`.
- The provider exposes separate list and detail contexts to avoid sharing large state.

**Component Map**

- `MoexIndexesProvider`: `web/src/components/moex-indexes/moex-indexes-context.tsx`
- List context: `web/src/components/moex-indexes/list/moex-indexes-list-context.tsx`
- Detail context: `web/src/components/moex-indexes/detail/moex-indexes-detail-context.tsx`
- List container: `web/src/components/moex-indexes/list/index-list-card.tsx`
- List filters: `web/src/components/moex-indexes/list/index-list-filters.tsx`
- List pagination: `web/src/components/moex-indexes/list/index-list-pagination.tsx`
- List section + item: `web/src/components/moex-indexes/list/index-list-section.tsx`, `web/src/components/moex-indexes/list/index-list-item.tsx`
- Chart container: `web/src/components/moex-indexes/detail/index-chart-card.tsx`
- Chart renderer: `web/src/components/moex-indexes/detail/index-chart.tsx`
- Composition container: `web/src/components/moex-indexes/composition/index-composition-card.tsx`
- Composition chart: `web/src/components/moex-indexes/composition/index-composition-chart.tsx`

**State and Hooks**

- List types live in `web/src/components/moex-indexes/list/use-moex-indexes.types.ts`.
- Detail types live in `web/src/components/moex-indexes/detail/moex-indexes-detail.types.ts`.
- Utilities and constants live in `web/src/components/moex-indexes/list/use-moex-indexes.utils.ts`.

Hooks:

- `useMoexIndexesData` loads indexes, favorites, and collection metadata.
- `useMoexIndexListState` owns list UI state (search, filters, pagination) and derived sections.
- `useMoexIndexCollections` loads index collections and memberships, builds grouping metadata, and prepares filter options.
- `useMoexIndexList` handles search, filters, sorting, grouping, pagination, and empty states.
- `useMoexIndexDetailState` resolves the selected index and wires chart metadata.
- `useMoexIndexHistory` loads the 12-month history for the selected index and derives chart series and change metrics.
- `useMoexIndexComposition` loads the latest composition snapshot and weight history for top constituents.
  The weight history series is downsampled using the same interval control as the price chart.
  The composition card exposes Snapshot (treemap), Weight trend, and Stacked area tabs.

**Data Flow**

1. `useMoexIndexesData` loads the base index list (`moexClient.getIndexes()`).
2. Collections and memberships are loaded to build grouping and filter options.
3. User favorites are loaded from user settings and stored as a set for fast lookup.
4. `useMoexIndexListState` computes list sections, pagination, and filters.
5. `useMoexIndexDetailState` resolves the selected index and triggers history fetch.
6. `useMoexIndexComposition` fetches composition data for the selected index.

**Filtering, Sorting, Pagination**

- Search matches by `secid`, `shortName`, and `name`.
- Filters are multi-select for collection, currency, board, and calculation mode.
- Sorting options are defined in `SORT_OPTIONS` and applied in `useMoexIndexList`.
- Pagination is client-side. Filters or sorting reset the page to the first page.

**Favorites**

- Favorites are persisted via user settings and optimistically updated in the query cache.
- The list can be filtered to favorites only.

**Chart Data**

- History is fetched based on the selected time range (quick buttons + extra range selector, or custom dates).
- The interval control (Auto + fixed steps) determines how chart data is downsampled.
- Auto targets ~300 points by selecting the closest interval step for the range length.
- Chart points are normalized and ordered by date before sampling.
- Latest value, change, and change percent are computed for the header meta.
- The chart supports price vs percent-change view and line vs candlestick rendering.

**Layout and Scrolling**

- The page uses a full-height layout and constrains overflow so only the list scrolls.
- The list content uses `ScrollArea` and `min-h-0` on containers to avoid page scroll.
- The right column is split into two equal-height cards: the price chart and composition analytics.
- The chart card uses a two-column layout on larger screens (meta/controls left, chart right).
- The composition card mirrors this layout, keeping metadata and legend on the left and the chart/content on the right.

**Extending the Page**

- Add a new filter: update `list/use-moex-indexes.utils.ts` (options),
  `list/use-moex-indexes-list-state.ts` (state), and
  `list/index-list-filters.tsx` (UI).
- Add a new sort option: update `SORT_OPTIONS` and `sortComparators` in `list/use-moex-indexes.utils.ts`.
- Add new metadata chips: update `detail/index-chart-card.tsx` and ensure the data exists on `MoexIndex`.
