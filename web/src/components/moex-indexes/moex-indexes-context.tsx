'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { MoexIndexDetailProvider } from './detail/moex-indexes-detail-context';
import { useMoexIndexDetailState } from './detail/use-moex-indexes-detail-state';
import { MoexIndexListProvider } from './list/moex-indexes-list-context';
import { useMoexIndexListState } from './list/use-moex-indexes-list-state';
import { useMoexIndexesData } from './use-moex-indexes-data';
import {
  applyMoexIndexesUrlState,
  canonicalizeSearchParams,
  parseMoexIndexesUrlState,
} from './moex-indexes-url-state';
import { DEFAULT_PAGE_SIZE } from './list/use-moex-indexes.utils';
import type { FilterKey, SortKey } from './list/use-moex-indexes.types';
import type {
  ChartType,
  ChartViewMode,
  CompositionTab,
  IntervalKey,
  RangeKey,
} from './detail/moex-indexes-detail.types';

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [delayMs, value]);
  return debounced;
}

export function MoexIndexesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlKey = searchParams.toString();

  const parsedUrl = useMemo(() => parseMoexIndexesUrlState(searchParams), [urlKey, searchParams]);

  const dataState = useMoexIndexesData();
  const listState = useMoexIndexListState({
    indexes: dataState.indexes,
    indexesLoading: dataState.indexesLoading,
    indexesError: dataState.indexesError,
    settingsError: dataState.settingsError,
    collectionMemberships: dataState.collectionMemberships,
    groupingCollections: dataState.groupingCollections,
    indexCollectionsMap: dataState.indexCollectionsMap,
    collectionOptions: dataState.collectionOptions,
    collectionsLoading: dataState.collectionsLoading,
    collectionsError: dataState.collectionsError,
    favoritesSet: dataState.favoritesSet,
    toggleFavorite: dataState.toggleFavorite,
    initial: {
      ...parsedUrl.list,
      selectedSecid:
        parsedUrl.selectedSecid !== undefined ? parsedUrl.selectedSecid : null,
    },
  });
  const detailState = useMoexIndexDetailState({
    indexes: dataState.indexes,
    favorites: dataState.favorites,
    favoritesBySecid: dataState.favoritesBySecid,
    selectedSecid: listState.selectedSecid,
    indexCollectionsMap: dataState.indexCollectionsMap,
    initial: parsedUrl.detail,
  });

  const listRef = useRef(listState);
  const detailRef = useRef(detailState);
  listRef.current = listState;
  detailRef.current = detailState;

  const debouncedQuery = useDebouncedValue(listState.query, 350);

  // URL -> local state on initial load (no router navigation needed for our own updates).
  useEffect(() => {
    const ls = listRef.current;
    const ds = detailRef.current;
    const next = parseMoexIndexesUrlState(searchParams);

    const nextSelectedSecid =
      next.selectedSecid !== undefined ? next.selectedSecid : null;
    if (nextSelectedSecid !== ls.selectedSecid) {
      ls.setSelectedSecid(nextSelectedSecid);
    }

    const nextQuery = next.list?.query ?? '';
    if (nextQuery !== ls.query) ls.setQuery(nextQuery);

    const nextFavOnly = next.list?.showFavoritesOnly ?? false;
    if (nextFavOnly !== ls.showFavoritesOnly) {
      ls.setShowFavoritesOnly(nextFavOnly);
    }

    const nextSortKey = (next.list?.sortKey ?? 'name-asc') as SortKey;
    if (nextSortKey !== ls.sortKey) ls.setSortKey(nextSortKey);

    const nextPageSize = next.list?.pageSize ?? DEFAULT_PAGE_SIZE;
    if (nextPageSize !== ls.pageSize) ls.setPageSize(nextPageSize);

    if (!next.list?.filters) {
      if (ls.hasActiveFilters) ls.clearFilters();
    } else {
      (['collections', 'currency', 'board', 'calcMode'] as const satisfies FilterKey[]).forEach((key) => {
        const nextValues = next.list?.filters?.[key] ?? [];
        const currentValues = ls.filters[key] ?? [];
        const sortedNext = [...nextValues].sort();
        const sortedCurrent = [...currentValues].sort();
        const same =
          sortedNext.length === sortedCurrent.length &&
          sortedNext.every((value, index) => value === sortedCurrent[index]);
        if (!same) ls.setFilter(key, sortedNext);
      });
    }

    const nextPageIndex = next.list?.pageIndex ?? 0;
    if (nextPageIndex !== ls.pageIndex) ls.setPageIndex(nextPageIndex);

    const nextRange = (next.detail?.rangeKey ?? '1y') as RangeKey;
    if (nextRange !== ds.rangeKey) ds.setRangeKey(nextRange);

    const nextInterval = (next.detail?.intervalKey ?? 'auto') as IntervalKey;
    if (nextInterval !== ds.intervalKey) ds.setIntervalKey(nextInterval);

    const nextFrom = next.detail?.customFrom;
    if (typeof nextFrom === 'string' && nextFrom !== ds.customFrom) {
      ds.setCustomFrom(nextFrom);
    }
    const nextTill = next.detail?.customTill;
    if (typeof nextTill === 'string' && nextTill !== ds.customTill) {
      ds.setCustomTill(nextTill);
    }

    const nextView = (next.detail?.viewMode ?? 'price') as ChartViewMode;
    if (nextView !== ds.viewMode) ds.setViewMode(nextView);

    const nextType = (next.detail?.chartType ?? 'line') as ChartType;
    if (nextType !== ds.chartType) ds.setChartType(nextType);

    const nextTab = (next.detail?.compositionTab ?? 'snapshot') as CompositionTab;
    if (nextTab !== ds.compositionTab) ds.setCompositionTab(nextTab);
  }, [urlKey, searchParams]);

  // local state -> URL (debounced for query typing).
  useEffect(() => {
    // Use history API directly to avoid Next.js navigations (which can trigger refresh/fallback in prod).
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams(window.location.search);

    applyMoexIndexesUrlState(next, {
      selectedSecid: listState.selectedSecid,
      list: {
        query: debouncedQuery,
        showFavoritesOnly: listState.showFavoritesOnly,
        pageIndex: listState.pageIndex,
        pageSize: listState.pageSize,
        sortKey: listState.sortKey,
        filters: listState.filters,
      },
      detail: {
        rangeKey: detailState.rangeKey,
        intervalKey: detailState.intervalKey,
        customFrom: detailState.customFrom,
        customTill: detailState.customTill,
        viewMode: detailState.viewMode,
        chartType: detailState.chartType,
        compositionTab: detailState.compositionTab,
      },
    });

    const currentCanonical = canonicalizeSearchParams(current);
    const nextCanonical = canonicalizeSearchParams(next);
    if (currentCanonical === nextCanonical) return;

    const hash = window.location.hash || '';
    const nextUrl = nextCanonical.length > 0 ? `${pathname}?${nextCanonical}${hash}` : `${pathname}${hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [
    debouncedQuery,
    detailState.chartType,
    detailState.compositionTab,
    detailState.customFrom,
    detailState.customTill,
    detailState.intervalKey,
    detailState.rangeKey,
    detailState.viewMode,
    listState.filters,
    listState.pageIndex,
    listState.pageSize,
    listState.selectedSecid,
    listState.showFavoritesOnly,
    listState.sortKey,
    pathname,
  ]);

  // Back/forward -> local state.
  useEffect(() => {
    const handler = () => {
      const next = parseMoexIndexesUrlState(new URLSearchParams(window.location.search));

      const ls = listRef.current;
      const ds = detailRef.current;

      const nextSelectedSecid =
        next.selectedSecid !== undefined ? next.selectedSecid : null;
      if (nextSelectedSecid !== ls.selectedSecid) {
        ls.setSelectedSecid(nextSelectedSecid);
      }

      const nextQuery = next.list?.query ?? '';
      if (nextQuery !== ls.query) ls.setQuery(nextQuery);

      const nextFavOnly = next.list?.showFavoritesOnly ?? false;
      if (nextFavOnly !== ls.showFavoritesOnly) {
        ls.setShowFavoritesOnly(nextFavOnly);
      }

      const nextSortKey = (next.list?.sortKey ?? 'name-asc') as SortKey;
      if (nextSortKey !== ls.sortKey) ls.setSortKey(nextSortKey);

      const nextPageSize = next.list?.pageSize ?? DEFAULT_PAGE_SIZE;
      if (nextPageSize !== ls.pageSize) ls.setPageSize(nextPageSize);

      if (!next.list?.filters) {
        if (ls.hasActiveFilters) ls.clearFilters();
      } else {
        (['collections', 'currency', 'board', 'calcMode'] as const satisfies FilterKey[]).forEach((key) => {
          const nextValues = next.list?.filters?.[key] ?? [];
          const currentValues = ls.filters[key] ?? [];
          const sortedNext = [...nextValues].sort();
          const sortedCurrent = [...currentValues].sort();
          const same =
            sortedNext.length === sortedCurrent.length &&
            sortedNext.every((value, index) => value === sortedCurrent[index]);
          if (!same) ls.setFilter(key, sortedNext);
        });
      }

      const nextPageIndex = next.list?.pageIndex ?? 0;
      if (nextPageIndex !== ls.pageIndex) ls.setPageIndex(nextPageIndex);

      const nextRange = (next.detail?.rangeKey ?? '1y') as RangeKey;
      if (nextRange !== ds.rangeKey) ds.setRangeKey(nextRange);

      const nextInterval = (next.detail?.intervalKey ?? 'auto') as IntervalKey;
      if (nextInterval !== ds.intervalKey) ds.setIntervalKey(nextInterval);

      const nextFrom = next.detail?.customFrom;
      if (typeof nextFrom === 'string' && nextFrom !== ds.customFrom) {
        ds.setCustomFrom(nextFrom);
      }
      const nextTill = next.detail?.customTill;
      if (typeof nextTill === 'string' && nextTill !== ds.customTill) {
        ds.setCustomTill(nextTill);
      }

      const nextView = (next.detail?.viewMode ?? 'price') as ChartViewMode;
      if (nextView !== ds.viewMode) ds.setViewMode(nextView);

      const nextType = (next.detail?.chartType ?? 'line') as ChartType;
      if (nextType !== ds.chartType) ds.setChartType(nextType);

      const nextTab = (next.detail?.compositionTab ?? 'snapshot') as CompositionTab;
      if (nextTab !== ds.compositionTab) ds.setCompositionTab(nextTab);
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  return (
    <MoexIndexListProvider value={listState}>
      <MoexIndexDetailProvider value={detailState}>
        {children}
      </MoexIndexDetailProvider>
    </MoexIndexListProvider>
  );
}
