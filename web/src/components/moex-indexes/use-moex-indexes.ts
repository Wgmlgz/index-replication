'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moexClient, type MoexIndex } from '@/lib/moex-client';
import {
  userSettingsClient,
  type UserSettings,
} from '@/lib/user-settings-client';
import { useMoexIndexCollections } from './use-moex-indexes-collections';
import { useMoexIndexHistory } from './use-moex-indexes-history';
import { useMoexIndexList } from './use-moex-indexes-list';
import type {
  FilterKey,
  FilterOptions,
  MoexIndexesState,
  SortKey,
} from './use-moex-indexes.types';
import {
  buildFilterOptions,
  createEmptyFilters,
  DEFAULT_PAGE_SIZE,
  FILTER_DEFS,
  SORT_OPTIONS,
} from './use-moex-indexes.utils';

export function useMoexIndexes(): MoexIndexesState {
  const [query, setQuery] = useState('');
  const [selectedSecid, setSelectedSecid] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filters, setFilters] = useState(createEmptyFilters);
  const [sortKey, setSortKey] = useState<SortKey>('name-asc');
  const queryClient = useQueryClient();

  const indexesQuery = useQuery({
    queryKey: ['moex-indexes'],
    queryFn: () => moexClient.getIndexes(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const indexes = indexesQuery.data ?? [];

  const {
    groupingCollections,
    collectionMemberships,
    indexCollectionsMap,
    collectionOptions,
    collectionsLoading,
    collectionsError,
  } = useMoexIndexCollections(indexes);

  const settingsQuery = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => userSettingsClient.getSettings(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const favorites = settingsQuery.data?.favorites ?? [];
  const favoritesSet = useMemo(
    () => new Set(favorites.map((item) => item.toUpperCase())),
    [favorites]
  );

  const favoritesBySecid = useMemo(() => {
    const map = new Map(indexes.map((item) => [item.secid.toUpperCase(), item]));
    return favorites
      .map((secid) => map.get(secid.toUpperCase()))
      .filter((item): item is MoexIndex => Boolean(item));
  }, [favorites, indexes]);

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
          def.emptyLabel
        );
        return;
      }
      options[def.key] = [];
    });
    return options;
  }, [collectionOptions, indexes]);

  const setFilter = (key: FilterKey, value: string[]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateFavorites = useMutation({
    mutationFn: (nextFavorites: string[]) =>
      userSettingsClient.patchSettings({ favorites: nextFavorites }),
    onMutate: async (nextFavorites: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['user-settings'] });
      const previous = queryClient.getQueryData<UserSettings>([
        'user-settings',
      ]);
      queryClient.setQueryData<UserSettings>(['user-settings'], (current) => ({
        favorites: nextFavorites,
        values: current?.values ?? previous?.values,
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['user-settings'], context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-settings'], data);
    },
  });

  const toggleFavorite = (secid: string) => {
    const key = secid.toUpperCase();
    const isFavorite = favoritesSet.has(key);
    const nextFavorites = isFavorite
      ? favorites.filter((item) => item.toUpperCase() !== key)
      : [...favorites, secid];
    updateFavorites.mutate(nextFavorites);
  };

  const selectedIndex = useMemo<MoexIndex | null>(() => {
    const findIndex = (secid: string) => {
      const key = secid.toUpperCase();
      return (
        favoritesBySecid.find((item) => item.secid.toUpperCase() === key) ??
        indexes.find((item) => item.secid.toUpperCase() === key) ??
        null
      );
    };

    if (selectedSecid) {
      return findIndex(selectedSecid);
    }

    const favoriteMatch = favorites.find((secid) => Boolean(findIndex(secid)));
    if (favoriteMatch) {
      return findIndex(favoriteMatch);
    }

    return findIndex('IMOEX') ?? favoritesBySecid[0] ?? indexes[0] ?? null;
  }, [favorites, favoritesBySecid, indexes, selectedSecid]);

  const {
    historyLoading,
    historyError,
    chartData,
    latestValue,
    change,
    changePercent,
    numberFormatter,
  } = useMoexIndexHistory(selectedIndex);

  const indexesLoading = indexesQuery.isLoading;
  const error = indexesQuery.error
    ? 'Не удалось загрузить список индексов.'
    : historyError
      ? 'Не удалось загрузить историю индекса.'
      : settingsQuery.error
        ? 'Не удалось загрузить пользовательские настройки.'
        : collectionsError
          ? 'Не удалось загрузить группы индексов.'
        : null;

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

  const selectedIndexCollections = useMemo(() => {
    if (!selectedIndex) return [];
    return indexCollectionsMap[selectedIndex.secid.toUpperCase()] ?? [];
  }, [indexCollectionsMap, selectedIndex?.secid]);

  const hasActiveFilters = Object.values(filters).some(
    (values) => values.length > 0
  );

  const clearFilters = () => {
    setFilters(createEmptyFilters());
  };

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
    historyLoading,
    error,
    listSections: sections,
    indexCollectionsMap,
    favoritesSet,
    toggleFavorite,
    selectedIndex,
    selectedIndexCollections,
    chartData,
    latestValue,
    change,
    changePercent,
    numberFormatter,
  };
}
