'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MoexIndex, MoexIndexCollection } from '@/lib/moex-client';
import type {
  FilterKey,
  FilterOptions,
  FilterOption,
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
}: ListStateInput): MoexIndexListState {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedSecid, setSelectedSecid] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState(createEmptyFilters);
  const [sortKey, setSortKey] = useState<SortKey>('name-asc');

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

  const setFilter = (key: FilterKey, value: string[]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
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
    indexesLoading,
    setPageIndex,
  });

  const hasActiveFilters = Object.values(filters).some(
    (values) => values.length > 0
  );

  const clearFilters = () => {
    setFilters(createEmptyFilters());
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
