import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { MoexIndex, MoexIndexCollection } from '@/lib/moex-client';
import type { IndexGroup, SortKey } from './use-moex-indexes.types';
import {
  compareStrings,
  EMPTY_FILTER_VALUE,
  UNCATEGORIZED_COLLECTION,
  sortComparators,
} from './use-moex-indexes.utils';

type IndexListInput = {
  indexes: MoexIndex[];
  favoritesSet: Set<string>;
  collectionMemberships: Record<string, string[]>;
  groupingCollections: MoexIndexCollection[];
  query: string;
  showFavoritesOnly: boolean;
  pageIndex: number;
  pageSize: number;
  selectedCollections: string[];
  selectedCurrencies: string[];
  selectedBoards: string[];
  selectedCalcModes: string[];
  sortKey: SortKey;
  indexesLoading: boolean;
  setPageIndex: Dispatch<SetStateAction<number>>;
};

type IndexListState = {
  favoriteIndexes: MoexIndex[];
  collectionGroups: IndexGroup[];
  foundCount: number;
  isEmpty: boolean;
  showNoFavoritesMessage: boolean;
  pageCount: number;
  showPagination: boolean;
};

export function useMoexIndexList({
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
}: IndexListInput): IndexListState {
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

  const favoriteIndexesAll = useMemo(
    () =>
      sortedIndexes.filter((index) =>
        favoritesSet.has(index.secid.toUpperCase())
      ),
    [sortedIndexes, favoritesSet]
  );

  const otherIndexesAll = useMemo(
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
    setPageIndex,
  ]);

  const paginationTarget = showFavoritesOnly
    ? favoriteIndexesAll
    : otherIndexesAll;

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(paginationTarget.length / pageSize));
  }, [paginationTarget.length, pageSize]);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1));
  }, [pageCount, setPageIndex]);

  const paginated = useMemo(() => {
    const start = pageIndex * pageSize;
    return paginationTarget.slice(start, start + pageSize);
  }, [pageIndex, pageSize, paginationTarget]);

  const visibleFavorites = showFavoritesOnly ? paginated : favoriteIndexesAll;
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
    ? favoriteIndexesAll.length
    : sortedIndexes.length;

  const showPagination = paginationTarget.length > 0;

  const showNoFavoritesMessage =
    showFavoritesOnly &&
    !indexesLoading &&
    sortedIndexes.length > 0 &&
    favoriteIndexesAll.length === 0;

  return {
    favoriteIndexes: visibleFavorites,
    collectionGroups,
    foundCount,
    isEmpty: sortedIndexes.length === 0,
    showNoFavoritesMessage,
    pageCount,
    showPagination,
  };
}
