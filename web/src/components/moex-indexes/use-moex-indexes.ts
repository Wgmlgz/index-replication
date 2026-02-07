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
import type { MoexIndexesState, SortKey } from './use-moex-indexes.types';
import {
  buildFilterOptions,
  DEFAULT_PAGE_SIZE,
  SORT_OPTIONS,
} from './use-moex-indexes.utils';

export function useMoexIndexes(): MoexIndexesState {
  const [query, setQuery] = useState('');
  const [selectedSecid, setSelectedSecid] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [selectedCalcModes, setSelectedCalcModes] = useState<string[]>([]);
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

  const currencyOptions = useMemo(
    () => buildFilterOptions(indexes.map((index) => index.currency), 'Без валюты'),
    [indexes]
  );

  const boardOptions = useMemo(
    () => buildFilterOptions(indexes.map((index) => index.boardId), 'Без Board'),
    [indexes]
  );

  const calcModeOptions = useMemo(
    () => buildFilterOptions(indexes.map((index) => index.calcMode), 'Без типа'),
    [indexes]
  );

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
    favoriteIndexes,
    collectionGroups,
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
    selectedCollections,
    selectedCurrencies,
    selectedBoards,
    selectedCalcModes,
    sortKey,
    indexesLoading,
    setPageIndex,
  });

  const selectedIndexCollections = useMemo(() => {
    if (!selectedIndex) return [];
    return indexCollectionsMap[selectedIndex.secid.toUpperCase()] ?? [];
  }, [indexCollectionsMap, selectedIndex?.secid]);

  const hasActiveFilters =
    selectedCollections.length > 0 ||
    selectedCurrencies.length > 0 ||
    selectedBoards.length > 0 ||
    selectedCalcModes.length > 0;

  const clearFilters = () => {
    setSelectedCollections([]);
    setSelectedCurrencies([]);
    setSelectedBoards([]);
    setSelectedCalcModes([]);
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
    collectionOptions,
    selectedCollections,
    setSelectedCollections,
    currencyOptions,
    selectedCurrencies,
    setSelectedCurrencies,
    boardOptions,
    selectedBoards,
    setSelectedBoards,
    calcModeOptions,
    selectedCalcModes,
    setSelectedCalcModes,
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
    favoriteIndexes,
    collectionGroups,
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
