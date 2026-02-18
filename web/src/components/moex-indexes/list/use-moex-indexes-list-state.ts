'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MoexIndex, MoexIndexCollection } from '@/lib/moex-client';
import type {
  FilterKey,
  FilterOptions,
  FilterOption,
  FilterState,
  LastActiveRange,
  MoexIndexListState,
  SortKey,
} from './use-moex-indexes.types';
import {
  buildFilterOptions,
  createEmptyFilters,
  DEFAULT_PAGE_SIZE,
  FILTER_DEFS,
  SORT_OPTIONS,
} from './use-moex-indexes.utils';
import { useMoexIndexList } from './use-moex-indexes-list';

type ListStateInput = {
  indexes: MoexIndex[];
  indexesLoading: boolean;
  indexesError: boolean;
  settingsError: boolean;
  collectionMemberships: Record<string, string[]>;
  groupingCollections: MoexIndexCollection[];
  indexCollectionsMap: Record<string, string[]>;
  collectionOptions: FilterOption[];
  collectionsLoading: boolean;
  collectionsError: boolean;
  favoritesSet: Set<string>;
  toggleFavorite: (secid: string) => void;
  initial?: Partial<{
    query: string;
    selectedSecid: string | null;
    showFavoritesOnly: boolean;
    pageIndex: number;
    pageSize: number;
    filters: FilterState;
    sortKey: SortKey;
    lastActiveRange: LastActiveRange;
    compositionOnly: boolean;
  }>;
};

export function useMoexIndexListState({
  indexes,
  indexesLoading,
  indexesError,
  settingsError,
  collectionMemberships,
  groupingCollections,
  indexCollectionsMap,
  collectionOptions,
  collectionsLoading,
  collectionsError,
  favoritesSet,
  toggleFavorite,
  initial,
}: ListStateInput): MoexIndexListState {
  const { t, i18n } = useTranslation();
  const [query, setQueryState] = useState(() => initial?.query ?? '');
  const [selectedSecid, setSelectedSecid] = useState<string | null>(
    () => initial?.selectedSecid ?? null
  );
  const [showFavoritesOnly, setShowFavoritesOnlyState] = useState(
    () => initial?.showFavoritesOnly ?? false
  );
  const [pageIndex, setPageIndex] = useState(() => initial?.pageIndex ?? 0);
  const [pageSize, setPageSizeState] = useState(
    () => initial?.pageSize ?? DEFAULT_PAGE_SIZE
  );
  const [filters, setFilters] = useState(
    () => initial?.filters ?? createEmptyFilters()
  );
  const [sortKey, setSortKeyState] = useState<SortKey>(
    () => initial?.sortKey ?? 'name-asc'
  );
  const [lastActiveRange, setLastActiveRangeState] = useState<LastActiveRange>(
    () => initial?.lastActiveRange ?? '1m'
  );
  const [compositionOnly, setCompositionOnlyState] = useState(
    () => initial?.compositionOnly ?? false
  );

  const filterOptions = useMemo<FilterOptions>(() => {
    const options = {} as FilterOptions;
    FILTER_DEFS.forEach((def) => {
      if (def.key === 'collections') {
        options[def.key] = collectionOptions;
        return;
      }
      if (def.getValue) {
        options[def.key] = buildFilterOptions(
          indexes.map((index) => def.getValue?.(index)),
          t(def.emptyLabelKey)
        );
        return;
      }
      options[def.key] = [];
    });
    return options;
  }, [collectionOptions, i18n.language, indexes, t]);

  const setQuery = (value: string) => {
    setQueryState(value);
    setPageIndex(0);
  };

  const setShowFavoritesOnly = (value: boolean) => {
    setShowFavoritesOnlyState(value);
    setPageIndex(0);
  };

  const setPageSize = (value: number) => {
    setPageSizeState(value);
    setPageIndex(0);
  };

  const setSortKey = (value: SortKey) => {
    setSortKeyState(value);
    setPageIndex(0);
  };

  const setFilter = (key: FilterKey, value: string[]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
    setPageIndex(0);
  };

  const setLastActiveRange = (value: LastActiveRange) => {
    setLastActiveRangeState(value);
    setPageIndex(0);
  };

  const setCompositionOnly = (value: boolean) => {
    setCompositionOnlyState(value);
    setPageIndex(0);
  };

  const {
    sections,
    foundCount,
    isEmpty,
    showNoFavoritesMessage,
    pageCount,
    showPagination,
  } = useMoexIndexList({
    indexes,
    favoritesSet,
    collectionMemberships,
    groupingCollections,
    query,
    showFavoritesOnly,
    pageIndex,
    pageSize,
    filters,
    sortKey,
    lastActiveRange,
    compositionOnly,
    indexesLoading,
    setPageIndex,
  });

  const hasActiveFilters =
    Object.values(filters).some((values) => values.length > 0) ||
    lastActiveRange !== '1m' ||
    compositionOnly;

  const clearFilters = () => {
    setFilters(createEmptyFilters());
    setLastActiveRangeState('1m');
    setCompositionOnlyState(false);
    setPageIndex(0);
  };

  const error = indexesError
    ? t('moex.errors.indexes')
    : settingsError
      ? t('moex.errors.settings')
      : collectionsError
        ? t('moex.errors.groups')
        : null;

  return {
    query,
    setQuery,
    selectedSecid,
    setSelectedSecid,
    showFavoritesOnly,
    setShowFavoritesOnly,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    pageCount,
    showPagination,
    filters,
    setFilter,
    filterOptions,
    sortKey,
    setSortKey,
    sortOptions: SORT_OPTIONS,
    lastActiveRange,
    setLastActiveRange,
    compositionOnly,
    setCompositionOnly,
    hasActiveFilters,
    clearFilters,
    foundCount,
    isEmpty,
    showNoFavoritesMessage,
    indexesLoading,
    collectionsLoading,
    error,
    listSections: sections,
    indexCollectionsMap,
    favoritesSet,
    toggleFavorite,
  };
}
