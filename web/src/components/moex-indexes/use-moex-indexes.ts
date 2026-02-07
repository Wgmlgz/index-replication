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
const UNCATEGORIZED_COLLECTION = '__uncategorized__';
const EMPTY_FILTER_VALUE = '__empty__';

type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

type SortOption = {
  value: SortKey;
  label: string;
};

type IndexGroup = {
  key: string;
  title: string;
  indexes: MoexIndex[];
};

type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'secid-asc'
  | 'secid-desc'
  | 'currency-asc'
  | 'board-asc'
  | 'calc-asc';

const SORT_OPTIONS: SortOption[] = [
  { value: 'name-asc', label: 'Название (А-Я)' },
  { value: 'name-desc', label: 'Название (Я-А)' },
  { value: 'secid-asc', label: 'Код (A-Z)' },
  { value: 'secid-desc', label: 'Код (Z-A)' },
  { value: 'currency-asc', label: 'Валюта' },
  { value: 'board-asc', label: 'Board' },
  { value: 'calc-asc', label: 'Тип расчета' },
];

const compareStrings = (left: string, right: string) =>
  left.localeCompare(right, 'ru', { sensitivity: 'base' });

const compareNullableStrings = (
  left: string | null | undefined,
  right: string | null | undefined
) => {
  const leftValue = left ?? '';
  const rightValue = right ?? '';
  if (!leftValue && rightValue) return 1;
  if (leftValue && !rightValue) return -1;
  return compareStrings(leftValue, rightValue);
};

const sortComparators: Record<SortKey, (a: MoexIndex, b: MoexIndex) => number> = {
  'name-asc': (a, b) => compareStrings(a.name, b.name),
  'name-desc': (a, b) => compareStrings(b.name, a.name),
  'secid-asc': (a, b) => compareStrings(a.secid, b.secid),
  'secid-desc': (a, b) => compareStrings(b.secid, a.secid),
  'currency-asc': (a, b) => compareNullableStrings(a.currency, b.currency),
  'board-asc': (a, b) => compareNullableStrings(a.boardId, b.boardId),
  'calc-asc': (a, b) => compareNullableStrings(a.calcMode, b.calcMode),
};

const buildFilterOptions = (
  values: Array<string | null | undefined>,
  emptyLabel: string
): FilterOption[] => {
  const counts = new Map<string, number>();
  let emptyCount = 0;

  values.forEach((value) => {
    if (value === null || value === undefined || value === '') {
      emptyCount += 1;
      return;
    }
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const options = Array.from(counts.entries())
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([value, count]) => ({ value, label: value, count }));

  if (emptyCount > 0) {
    options.push({
      value: EMPTY_FILTER_VALUE,
      label: emptyLabel,
      count: emptyCount,
    });
  }

  return options;
};

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
  collectionOptions: FilterOption[];
  selectedCollections: string[];
  setSelectedCollections: (value: string[]) => void;
  currencyOptions: FilterOption[];
  selectedCurrencies: string[];
  setSelectedCurrencies: (value: string[]) => void;
  boardOptions: FilterOption[];
  selectedBoards: string[];
  setSelectedBoards: (value: string[]) => void;
  calcModeOptions: FilterOption[];
  selectedCalcModes: string[];
  setSelectedCalcModes: (value: string[]) => void;
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
  sortOptions: SortOption[];
  hasActiveFilters: boolean;
  clearFilters: () => void;
  foundCount: number;
  isEmpty: boolean;
  showNoFavoritesMessage: boolean;
  indexesLoading: boolean;
  collectionsLoading: boolean;
  historyLoading: boolean;
  error: string | null;
  favoriteIndexes: MoexIndex[];
  collectionGroups: IndexGroup[];
  indexCollectionsMap: Record<string, string[]>;
  favoritesSet: Set<string>;
  toggleFavorite: (secid: string) => void;
  selectedIndex: MoexIndex | null;
  selectedIndexCollections: string[];
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
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [selectedCalcModes, setSelectedCalcModes] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('name-asc');
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

  const collectionsQuery = useQuery({
    queryKey: ['moex-index-collections'],
    queryFn: () => moexClient.getIndexCollections(),
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const collections = collectionsQuery.data ?? [];
  const groupingCollections = useMemo(
    () =>
      collections.filter(
        (collection) => collection.name !== 'stock_index_all'
      ),
    [collections]
  );

  const collectionsKey = useMemo(
    () =>
      groupingCollections
        .map((collection) => collection.name)
        .sort()
        .join('|'),
    [groupingCollections]
  );

  const membershipsQuery = useQuery({
    queryKey: ['moex-index-collection-memberships', collectionsKey],
    queryFn: () =>
      moexClient.getIndexCollectionMemberships(groupingCollections),
    enabled: groupingCollections.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const collectionMemberships = membershipsQuery.data ?? {};

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

  const collectionTitleByName = useMemo(() => {
    return new Map(
      groupingCollections.map((collection) => [collection.name, collection.title])
    );
  }, [groupingCollections]);

  const indexCollectionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.entries(collectionMemberships).forEach(([secid, names]) => {
      map[secid] = names
        .map((name) => collectionTitleByName.get(name) ?? name)
        .filter((value) => value.length > 0);
    });
    return map;
  }, [collectionMemberships, collectionTitleByName]);

  const favoritesBySecid = useMemo(() => {
    const map = new Map(
      indexes.map(item => [item.secid.toUpperCase(), item]),
    );
    return favorites
      .map(secid => map.get(secid.toUpperCase()))
      .filter((item): item is MoexIndex => Boolean(item));
  }, [favorites, indexes]);

  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    groupingCollections.forEach((collection) => {
      counts.set(collection.name, 0);
    });

    let uncategorized = 0;
    indexes.forEach((index) => {
      const membership =
        collectionMemberships[index.secid.toUpperCase()] ?? [];
      if (membership.length === 0) {
        uncategorized += 1;
        return;
      }
      membership.forEach((name) => {
        if (!counts.has(name)) return;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      });
    });

    return { counts, uncategorized };
  }, [collectionMemberships, groupingCollections, indexes]);

  const collectionOptions = useMemo(() => {
    const sorted = [...groupingCollections].sort((left, right) =>
      compareStrings(left.title, right.title)
    );
    const options = sorted.map((collection) => ({
      value: collection.name,
      label: collection.title,
      count: collectionCounts.counts.get(collection.name) ?? 0,
    }));

    if (collectionCounts.uncategorized > 0) {
      options.push({
        value: UNCATEGORIZED_COLLECTION,
        label: 'Без категории',
        count: collectionCounts.uncategorized,
      });
    }

    return options;
  }, [collectionCounts, groupingCollections]);

  const currencyOptions = useMemo(
    () => buildFilterOptions(indexes.map((index) => index.currency), 'Без валюты'),
    [indexes]
  );

  const boardOptions = useMemo(
    () => buildFilterOptions(indexes.map((index) => index.boardId), 'Без Board'),
    [indexes]
  );

  const calcModeOptions = useMemo(
    () =>
      buildFilterOptions(indexes.map((index) => index.calcMode), 'Без типа'),
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
  const collectionsLoading =
    collectionsQuery.isLoading || membershipsQuery.isLoading;
  const historyLoading = historyQuery.isLoading;
  const error = indexesQuery.error
    ? 'Не удалось загрузить список индексов.'
    : historyQuery.error
      ? 'Не удалось загрузить историю индекса.'
      : settingsQuery.error
        ? 'Не удалось загрузить пользовательские настройки.'
        : collectionsQuery.error || membershipsQuery.error
          ? 'Не удалось загрузить группы индексов.'
        : null;

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (index: MoexIndex) => {
    if (!normalizedQuery) return true;
    const haystack =
      `${index.secid} ${index.shortName} ${index.name}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  };

  const collectionSet = useMemo(
    () => new Set(selectedCollections),
    [selectedCollections]
  );
  const currencySet = useMemo(
    () => new Set(selectedCurrencies),
    [selectedCurrencies]
  );
  const boardSet = useMemo(() => new Set(selectedBoards), [selectedBoards]);
  const calcModeSet = useMemo(
    () => new Set(selectedCalcModes),
    [selectedCalcModes]
  );

  const matchesFilterValue = (
    value: string | null | undefined,
    set: Set<string>
  ) => {
    if (set.size === 0) return true;
    const key = value ?? EMPTY_FILTER_VALUE;
    return set.has(key);
  };

  const matchesCollections = (index: MoexIndex) => {
    if (collectionSet.size === 0) return true;
    const membership =
      collectionMemberships[index.secid.toUpperCase()] ?? [];
    if (membership.some((name) => collectionSet.has(name))) {
      return true;
    }
    return (
      membership.length === 0 &&
      collectionSet.has(UNCATEGORIZED_COLLECTION)
    );
  };

  const filteredIndexes = useMemo(() => {
    return indexes.filter((index) => {
      if (!matchesQuery(index)) return false;
      if (!matchesCollections(index)) return false;
      if (!matchesFilterValue(index.currency, currencySet)) return false;
      if (!matchesFilterValue(index.boardId, boardSet)) return false;
      if (!matchesFilterValue(index.calcMode, calcModeSet)) return false;
      return true;
    });
  }, [
    indexes,
    normalizedQuery,
    collectionMemberships,
    collectionSet,
    currencySet,
    boardSet,
    calcModeSet,
  ]);

  const sortedIndexes = useMemo(() => {
    const comparator = sortComparators[sortKey];
    return [...filteredIndexes].sort(comparator);
  }, [filteredIndexes, sortKey]);

  const favoriteIndexes = useMemo(
    () =>
      sortedIndexes.filter((index) =>
        favoritesSet.has(index.secid.toUpperCase())
      ),
    [sortedIndexes, favoritesSet]
  );

  const otherIndexes = useMemo(
    () =>
      sortedIndexes.filter(
        (index) => !favoritesSet.has(index.secid.toUpperCase())
      ),
    [sortedIndexes, favoritesSet]
  );

  useEffect(() => {
    setPageIndex(0);
  }, [
    normalizedQuery,
    showFavoritesOnly,
    pageSize,
    selectedCollections,
    selectedCurrencies,
    selectedBoards,
    selectedCalcModes,
    sortKey,
  ]);

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

  const groupingOrder = useMemo(() => {
    return [...groupingCollections].sort((left, right) =>
      compareStrings(left.title, right.title)
    );
  }, [groupingCollections]);

  const collectionGroups = useMemo(() => {
    const groups = new Map<string, IndexGroup>();
    groupingOrder.forEach((collection) => {
      groups.set(collection.name, {
        key: collection.name,
        title: collection.title,
        indexes: [],
      });
    });

    const uncategorized: IndexGroup = {
      key: UNCATEGORIZED_COLLECTION,
      title: 'Без категории',
      indexes: [],
    };

    const source = showFavoritesOnly ? visibleFavorites : visibleOthers;
    source.forEach((index) => {
      const membership =
        collectionMemberships[index.secid.toUpperCase()] ?? [];
      if (membership.length === 0) {
        uncategorized.indexes.push(index);
        return;
      }
      membership.forEach((name) => {
        const group = groups.get(name);
        if (group) {
          group.indexes.push(index);
        }
      });
    });

    const orderedGroups: IndexGroup[] = [];
    groupingOrder.forEach((collection) => {
      const group = groups.get(collection.name);
      if (group && group.indexes.length > 0) {
        orderedGroups.push(group);
      }
    });
    if (uncategorized.indexes.length > 0) {
      orderedGroups.push(uncategorized);
    }

    return orderedGroups;
  }, [
    collectionMemberships,
    groupingOrder,
    showFavoritesOnly,
    visibleFavorites,
    visibleOthers,
  ]);

  const foundCount = showFavoritesOnly
    ? favoriteIndexes.length
    : sortedIndexes.length;

  const showPagination = paginationTarget.length > 0;

  const showNoFavoritesMessage =
    showFavoritesOnly &&
    !indexesLoading &&
    sortedIndexes.length > 0 &&
    favoriteIndexes.length === 0;

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

  const selectedIndexCollections = useMemo(() => {
    if (!selectedIndex) return [];
    return (
      indexCollectionsMap[selectedIndex.secid.toUpperCase()] ?? []
    );
  }, [indexCollectionsMap, selectedIndex?.secid]);

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
    isEmpty: sortedIndexes.length === 0,
    showNoFavoritesMessage,
    indexesLoading,
    collectionsLoading,
    historyLoading,
    error,
    favoriteIndexes: visibleFavorites,
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
