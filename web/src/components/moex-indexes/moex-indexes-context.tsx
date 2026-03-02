'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { MoexIndexDetailProvider } from './detail/moex-indexes-detail-context';
import { useMoexSelectedIndex } from './detail/use-moex-selected-index';
import { MoexIndexListProvider } from './list/moex-indexes-list-context';
import { useMoexIndexListState } from './list/use-moex-indexes-list-state';
import { useMoexIndexesData } from './use-moex-indexes-data';
import {
  applyMoexIndexesUrlState,
  parseMoexIndexesUrlState,
} from './moex-indexes-url-state';
import { DEFAULT_PAGE_SIZE } from './list/use-moex-indexes.utils';
import type { FilterKey } from './list/use-moex-indexes.types';
import { useUrlStateSync } from '@/lib/url-state/use-url-state-sync';

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

  const detailState = useMoexSelectedIndex({
    indexes: dataState.indexes,
    favorites: dataState.favorites,
    favoritesBySecid: dataState.favoritesBySecid,
    selectedSecid: listState.selectedSecid,
    indexCollectionsMap: dataState.indexCollectionsMap,
  });

  const listRef = useRef(listState);
  useEffect(() => {
    listRef.current = listState;
  }, [listState]);

  const debouncedQuery = useDebouncedValue(listState.query, 350);

  const applyParsedUrlState = (
    next: ReturnType<typeof parseMoexIndexesUrlState>
  ) => {
    const ls = listRef.current;

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

    const nextSortKey = next.list?.sortKey ?? 'name-asc';
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
      LIST_FILTER_KEYS.forEach(key => {
        if (ls.filters[key].length > 0) ls.setFilter(key, []);
      });
    } else {
      LIST_FILTER_KEYS.forEach(key => {
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
  };

  const urlStateKey = useMemo(
    () =>
      JSON.stringify({
        selectedSecid: listState.selectedSecid,
        query: debouncedQuery,
        showFavoritesOnly: listState.showFavoritesOnly,
        pageIndex: listState.pageIndex,
        pageSize: listState.pageSize,
        sortKey: listState.sortKey,
        filters: listState.filters,
        lastActiveRange: listState.lastActiveRange,
        compositionOnly: listState.compositionOnly,
      }),
    [
      debouncedQuery,
      listState.compositionOnly,
      listState.filters,
      listState.lastActiveRange,
      listState.pageIndex,
      listState.pageSize,
      listState.selectedSecid,
      listState.showFavoritesOnly,
      listState.sortKey,
    ]
  );

  useUrlStateSync({
    pathname,
    urlKey,
    stateKey: urlStateKey,
    parse: params => parseMoexIndexesUrlState(params),
    applyParsedState: applyParsedUrlState,
    buildSearchParams: () => {
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
      });

      return next;
    },
  });

  return (
    <MoexIndexListProvider value={listState}>
      <MoexIndexDetailProvider value={detailState}>
        {children}
      </MoexIndexDetailProvider>
    </MoexIndexListProvider>
  );
}
