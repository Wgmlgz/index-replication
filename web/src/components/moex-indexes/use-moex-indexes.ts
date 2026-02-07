'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moexClient, type MoexIndex } from '@/lib/moex-client';
import {
  userSettingsClient,
  type UserSettings,
} from '@/lib/user-settings-client';
import type { ChartPoint } from './index-chart';

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');
const DEFAULT_PAGE_SIZE = 20;

type MoexIndexesState = {
  query: string;
  setQuery: (value: string) => void;
  selectedSecid: string | null;
  setSelectedSecid: (value: string | null) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (value: boolean) => void;
  pageIndex: number;
  setPageIndex: (value: number) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  pageCount: number;
  showPagination: boolean;
  foundCount: number;
  isEmpty: boolean;
  showNoFavoritesMessage: boolean;
  indexesLoading: boolean;
  historyLoading: boolean;
  error: string | null;
  favoriteIndexes: MoexIndex[];
  otherIndexes: MoexIndex[];
  favoritesSet: Set<string>;
  toggleFavorite: (secid: string) => void;
  selectedIndex: MoexIndex | null;
  chartData: ChartPoint[];
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
};

export function useMoexIndexes(): MoexIndexesState {
  const [query, setQuery] = useState('');
  const [selectedSecid, setSelectedSecid] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const queryClient = useQueryClient();

  const dateRange = useMemo(() => {
    const today = new Date();
    return {
      from: formatDate(subDays(today, 365)),
      till: formatDate(today),
    };
  }, []);

  const indexesQuery = useQuery({
    queryKey: ['moex-indexes'],
    queryFn: () => moexClient.getIndexes(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const indexes = indexesQuery.data ?? [];

  const settingsQuery = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => userSettingsClient.getSettings(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const favorites = settingsQuery.data?.favorites ?? [];
  const favoritesSet = useMemo(
    () => new Set(favorites.map(item => item.toUpperCase())),
    [favorites],
  );

  const favoritesBySecid = useMemo(() => {
    const map = new Map(
      indexes.map(item => [item.secid.toUpperCase(), item]),
    );
    return favorites
      .map(secid => map.get(secid.toUpperCase()))
      .filter((item): item is MoexIndex => Boolean(item));
  }, [favorites, indexes]);

  const updateFavorites = useMutation({
    mutationFn: (nextFavorites: string[]) =>
      userSettingsClient.patchSettings({ favorites: nextFavorites }),
    onMutate: async (nextFavorites: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['user-settings'] });
      const previous = queryClient.getQueryData<UserSettings>([
        'user-settings',
      ]);
      queryClient.setQueryData<UserSettings>(['user-settings'], current => ({
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
    onSuccess: data => {
      queryClient.setQueryData(['user-settings'], data);
    },
  });

  const selectedIndex = useMemo<MoexIndex | null>(() => {
    const findIndex = (secid: string) => {
      const key = secid.toUpperCase();
      return (
        favoritesBySecid.find(item => item.secid.toUpperCase() === key) ??
        indexes.find(item => item.secid.toUpperCase() === key) ??
        null
      );
    };

    if (selectedSecid) {
      return findIndex(selectedSecid);
    }

    const favoriteMatch = favorites.find(secid => Boolean(findIndex(secid)));
    if (favoriteMatch) {
      return findIndex(favoriteMatch);
    }

    return (
      findIndex('IMOEX') ??
      favoritesBySecid[0] ??
      indexes[0] ??
      null
    );
  }, [favorites, favoritesBySecid, indexes, selectedSecid]);

  const historyQuery = useQuery({
    queryKey: [
      'moex-index-history',
      selectedIndex?.secid,
      dateRange.from,
      dateRange.till,
    ],
    queryFn: () =>
      moexClient.getIndexHistory(selectedIndex!.secid, {
        from: dateRange.from,
        till: dateRange.till,
      }),
    enabled: Boolean(selectedIndex?.secid),
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const history = historyQuery.data ?? [];
  const indexesLoading = indexesQuery.isLoading;
  const historyLoading = historyQuery.isLoading;
  const error = indexesQuery.error
    ? 'Не удалось загрузить список индексов.'
    : historyQuery.error
      ? 'Не удалось загрузить историю индекса.'
      : settingsQuery.error
        ? 'Не удалось загрузить пользовательские настройки.'
        : null;

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (index: MoexIndex) => {
    if (!normalizedQuery) return true;
    const haystack =
      `${index.secid} ${index.shortName} ${index.name}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  };

  const filteredFavorites = useMemo(
    () => favoritesBySecid.filter(matchesQuery),
    [favoritesBySecid, normalizedQuery],
  );

  const filteredIndexes = useMemo(
    () => indexes.filter(matchesQuery),
    [indexes, normalizedQuery],
  );

  const favoriteIndexes = useMemo(
    () =>
      filteredIndexes.filter(index =>
        favoritesSet.has(index.secid.toUpperCase()),
      ),
    [filteredIndexes, favoritesSet],
  );

  const otherIndexes = useMemo(
    () =>
      filteredIndexes.filter(
        index => !favoritesSet.has(index.secid.toUpperCase()),
      ),
    [filteredIndexes, favoritesSet],
  );

  useEffect(() => {
    setPageIndex(0);
  }, [normalizedQuery, showFavoritesOnly, pageSize]);

  const paginationTarget = showFavoritesOnly ? favoriteIndexes : otherIndexes;

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(paginationTarget.length / pageSize));
  }, [paginationTarget.length, pageSize]);

  useEffect(() => {
    setPageIndex(current => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const paginated = useMemo(() => {
    const start = pageIndex * pageSize;
    return paginationTarget.slice(start, start + pageSize);
  }, [pageIndex, pageSize, paginationTarget]);

  const visibleFavorites = showFavoritesOnly ? paginated : favoriteIndexes;
  const visibleOthers = showFavoritesOnly ? [] : paginated;

  const foundCount = showFavoritesOnly
    ? favoriteIndexes.length
    : filteredIndexes.length;

  const showPagination = paginationTarget.length > 0;

  const showNoFavoritesMessage =
    showFavoritesOnly &&
    !indexesLoading &&
    filteredIndexes.length > 0 &&
    favoriteIndexes.length === 0;

  const toggleFavorite = (secid: string) => {
    const key = secid.toUpperCase();
    const isFavorite = favoritesSet.has(key);
    const nextFavorites = isFavorite
      ? favorites.filter(item => item.toUpperCase() !== key)
      : [...favorites, secid];
    updateFavorites.mutate(nextFavorites);
  };

  const normalizedHistory = useMemo(() => {
    return history
      .filter(point => point.tradeDate && point.close !== null)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  }, [history]);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      normalizedHistory.map(point => ({
        time: point.tradeDate,
        value: point.close as number,
      })),
    [normalizedHistory],
  );

  const latestPoint = normalizedHistory[normalizedHistory.length - 1];
  const previousPoint = normalizedHistory[normalizedHistory.length - 2];
  const latestValue = latestPoint?.close ?? null;
  const previousValue = previousPoint?.close ?? null;
  const change =
    latestValue !== null && previousValue !== null
      ? latestValue - previousValue
      : null;
  const changePercent =
    change !== null && previousValue ? (change / previousValue) * 100 : null;

  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: selectedIndex?.decimals ?? 2,
    });
  }, [selectedIndex?.decimals]);

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
    foundCount,
    isEmpty: filteredIndexes.length === 0,
    showNoFavoritesMessage,
    indexesLoading,
    historyLoading,
    error,
    favoriteIndexes: visibleFavorites,
    otherIndexes: visibleOthers,
    favoritesSet,
    toggleFavorite,
    selectedIndex,
    chartData,
    latestValue,
    change,
    changePercent,
    numberFormatter,
  };
}
