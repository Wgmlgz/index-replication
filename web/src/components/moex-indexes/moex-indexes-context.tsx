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
import type { FilterKey } from './list/use-moex-indexes.types';

const LIST_FILTER_KEYS = ['collections', 'currency', 'board', 'calcMode'] as const satisfies FilterKey[];

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

  const parsedUrl = useMemo(
    () => parseMoexIndexesUrlState(new URLSearchParams(urlKey)),
    [urlKey]
  );

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
  useEffect(() => {
    listRef.current = listState;
    detailRef.current = detailState;
  }, [detailState, listState]);

  const debouncedQuery = useDebouncedValue(listState.query, 350);

  // URL -> local state on initial load (no router navigation needed for our own updates).
  useEffect(() => {
    const ls = listRef.current;
    const ds = detailRef.current;
    const next = parseMoexIndexesUrlState(new URLSearchParams(urlKey));

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

    const nextSortKey = (next.list?.sortKey ?? 'name-asc');
    if (nextSortKey !== ls.sortKey) ls.setSortKey(nextSortKey);

    const nextLastActiveRange = next.list?.lastActiveRange ?? '1m';
    if (nextLastActiveRange !== ls.lastActiveRange) {
      ls.setLastActiveRange(nextLastActiveRange);
    }

    const nextCompositionOnly = next.list?.compositionOnly ?? false;
    if (nextCompositionOnly !== ls.compositionOnly) {
      ls.setCompositionOnly(nextCompositionOnly);
    }

    const nextPageSize = next.list?.pageSize ?? DEFAULT_PAGE_SIZE;
    if (nextPageSize !== ls.pageSize) ls.setPageSize(nextPageSize);

    if (!next.list?.filters) {
      LIST_FILTER_KEYS.forEach((key) => {
        if (ls.filters[key].length > 0) ls.setFilter(key, []);
      });
    } else {
      LIST_FILTER_KEYS.forEach((key) => {
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

    const nextRange = (next.detail?.rangeKey ?? '1y');
    if (nextRange !== ds.rangeKey) ds.setRangeKey(nextRange);

    const nextInterval = (next.detail?.intervalKey ?? 'auto');
    if (nextInterval !== ds.intervalKey) ds.setIntervalKey(nextInterval);

    const nextFrom = next.detail?.customFrom;
    if (typeof nextFrom === 'string' && nextFrom !== ds.customFrom) {
      ds.setCustomFrom(nextFrom);
    }
    const nextTill = next.detail?.customTill;
    if (typeof nextTill === 'string' && nextTill !== ds.customTill) {
      ds.setCustomTill(nextTill);
    }

    const nextView = (next.detail?.viewMode ?? 'price');
    if (nextView !== ds.viewMode) ds.setViewMode(nextView);

    const nextType = (next.detail?.chartType ?? 'line');
    if (nextType !== ds.chartType) ds.setChartType(nextType);

    const nextTab = (next.detail?.compositionTab ?? 'snapshot');
    if (nextTab !== ds.compositionTab) ds.setCompositionTab(nextTab);
    const nextSelectionMode = (next.detail?.compositionSelectionMode ??
      'fixed');
    if (nextSelectionMode !== ds.compositionSelectionMode) {
      ds.setCompositionSelectionMode(nextSelectionMode);
    }
    const nextSelectionDate = next.detail?.compositionSelectionDate ?? '';
    if (nextSelectionDate !== ds.compositionSelectionDate) {
      ds.setCompositionSelectionDate(nextSelectionDate);
    }
    const parsedTopCount = next.detail?.compositionTopCount;
    const nextTopCount = parsedTopCount === undefined ? 10 : parsedTopCount;
    if (nextTopCount !== ds.compositionTopCount) {
      ds.setCompositionTopCount(nextTopCount);
    }
  }, [urlKey]);

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
        lastActiveRange: listState.lastActiveRange,
        compositionOnly: listState.compositionOnly,
      },
      detail: {
        rangeKey: detailState.rangeKey,
        intervalKey: detailState.intervalKey,
        customFrom: detailState.customFrom,
        customTill: detailState.customTill,
        viewMode: detailState.viewMode,
        chartType: detailState.chartType,
        compositionTab: detailState.compositionTab,
        compositionSelectionMode: detailState.compositionSelectionMode,
        compositionSelectionDate: detailState.compositionSelectionDate,
        compositionTopCount: detailState.compositionTopCount,
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
    detailState.compositionSelectionMode,
    detailState.compositionSelectionDate,
    detailState.compositionTopCount,
    listState.filters,
    listState.pageIndex,
    listState.pageSize,
    listState.selectedSecid,
    listState.showFavoritesOnly,
    listState.sortKey,
    listState.lastActiveRange,
    listState.compositionOnly,
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

      const nextSortKey = (next.list?.sortKey ?? 'name-asc');
      if (nextSortKey !== ls.sortKey) ls.setSortKey(nextSortKey);

      const nextLastActiveRange = next.list?.lastActiveRange ?? '1m';
      if (nextLastActiveRange !== ls.lastActiveRange) {
        ls.setLastActiveRange(nextLastActiveRange);
      }

      const nextCompositionOnly = next.list?.compositionOnly ?? false;
      if (nextCompositionOnly !== ls.compositionOnly) {
        ls.setCompositionOnly(nextCompositionOnly);
      }

      const nextPageSize = next.list?.pageSize ?? DEFAULT_PAGE_SIZE;
      if (nextPageSize !== ls.pageSize) ls.setPageSize(nextPageSize);

      if (!next.list?.filters) {
        LIST_FILTER_KEYS.forEach((key) => {
          if (ls.filters[key].length > 0) ls.setFilter(key, []);
        });
      } else {
        LIST_FILTER_KEYS.forEach((key) => {
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

      const nextRange = (next.detail?.rangeKey ?? '1y');
      if (nextRange !== ds.rangeKey) ds.setRangeKey(nextRange);

      const nextInterval = (next.detail?.intervalKey ?? 'auto');
      if (nextInterval !== ds.intervalKey) ds.setIntervalKey(nextInterval);

      const nextFrom = next.detail?.customFrom;
      if (typeof nextFrom === 'string' && nextFrom !== ds.customFrom) {
        ds.setCustomFrom(nextFrom);
      }
      const nextTill = next.detail?.customTill;
      if (typeof nextTill === 'string' && nextTill !== ds.customTill) {
        ds.setCustomTill(nextTill);
      }

      const nextView = (next.detail?.viewMode ?? 'price');
      if (nextView !== ds.viewMode) ds.setViewMode(nextView);

      const nextType = (next.detail?.chartType ?? 'line');
      if (nextType !== ds.chartType) ds.setChartType(nextType);

      const nextTab = (next.detail?.compositionTab ?? 'snapshot');
      if (nextTab !== ds.compositionTab) ds.setCompositionTab(nextTab);
      const nextSelectionMode = (next.detail?.compositionSelectionMode ??
        'fixed');
      if (nextSelectionMode !== ds.compositionSelectionMode) {
        ds.setCompositionSelectionMode(nextSelectionMode);
      }
      const nextSelectionDate = next.detail?.compositionSelectionDate ?? '';
      if (nextSelectionDate !== ds.compositionSelectionDate) {
        ds.setCompositionSelectionDate(nextSelectionDate);
      }
      const parsedTopCount = next.detail?.compositionTopCount;
      const nextTopCount = parsedTopCount === undefined ? 10 : parsedTopCount;
      if (nextTopCount !== ds.compositionTopCount) {
        ds.setCompositionTopCount(nextTopCount);
      }
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
