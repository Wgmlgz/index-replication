'use client';

import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moexClient, type MoexIndex } from '@/lib/moex-client';
import {
  userSettingsClient,
  type UserSettings,
} from '@/lib/user-settings-client';
import type { ChartPoint } from './index-chart';

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

type MoexIndexesState = {
  query: string;
  setQuery: (value: string) => void;
  selectedSecid: string | null;
  setSelectedSecid: (value: string | null) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (value: boolean) => void;
  indexesLoading: boolean;
  historyLoading: boolean;
  error: string | null;
  filteredIndexes: MoexIndex[];
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
    if (indexes.length === 0) return null;
    if (selectedSecid) {
      return (
        indexes.find(
          item => item.secid.toUpperCase() === selectedSecid.toUpperCase(),
        ) ?? null
      );
    }
    const favoriteMatch = favorites.find(secid =>
      indexes.some(index => index.secid.toUpperCase() === secid.toUpperCase()),
    );
    if (favoriteMatch) {
      return (
        indexes.find(
          item => item.secid.toUpperCase() === favoriteMatch.toUpperCase(),
        ) ?? null
      );
    }
    return indexes.find(item => item.secid === 'IMOEX') ?? indexes[0] ?? null;
  }, [indexes, selectedSecid, favorites]);

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

  const filteredIndexes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return indexes;
    return indexes.filter(index => {
      const haystack =
        `${index.secid} ${index.shortName} ${index.name}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [indexes, query]);

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
    indexesLoading,
    historyLoading,
    error,
    filteredIndexes,
    favoriteIndexes,
    otherIndexes,
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
