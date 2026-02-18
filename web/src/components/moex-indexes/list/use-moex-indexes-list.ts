import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { MoexIndex, MoexIndexCollection } from '@/lib/moex-client';
import { matchesLastActiveRange } from '@/components/moex-indexes/moex-indexes-activity';
import type {
  FilterKey,
  FilterState,
  IndexSection,
  LastActiveRange,
  SortKey,
} from './use-moex-indexes.types';
import {
  compareStrings,
  EMPTY_FILTER_VALUE,
  FILTER_DEFS,
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
  filters: FilterState;
  sortKey: SortKey;
  lastActiveRange: LastActiveRange;
  compositionOnly: boolean;
  indexesLoading: boolean;
  setPageIndex: Dispatch<SetStateAction<number>>;
};

type IndexListState = {
  sections: IndexSection[];
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
  filters,
  sortKey,
  lastActiveRange,
  compositionOnly,
  indexesLoading,
  setPageIndex,
}: IndexListInput): IndexListState {
  const { t, i18n } = useTranslation();
  const normalizedQuery = query.trim().toLowerCase();

  const filterSets = useMemo(() => {
    return FILTER_DEFS.reduce((acc, def) => {
      acc[def.key] = new Set(filters[def.key]);
      return acc;
    }, {} as Record<FilterKey, Set<string>>);
  }, [filters]);

  const matchesFilterValue = (
    value: string | null | undefined,
    set: Set<string>
  ) => {
    if (set.size === 0) return true;
    const key = value ?? EMPTY_FILTER_VALUE;
    return set.has(key);
  };

  const filteredIndexes = useMemo(() => {
    const collectionSet = filterSets.collections;
    return indexes.filter((index) => {
      if (normalizedQuery) {
        const haystack =
          `${index.secid} ${index.shortName} ${index.name}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      if (collectionSet.size > 0) {
        const membership =
          collectionMemberships[index.secid.toUpperCase()] ?? [];
        const matchesCollection =
          membership.some((name) => collectionSet.has(name)) ||
          (membership.length === 0 &&
            collectionSet.has(UNCATEGORIZED_COLLECTION));
        if (!matchesCollection) return false;
      }

      for (const def of FILTER_DEFS) {
        if (def.key === 'collections' || !def.getValue) continue;
        if (!matchesFilterValue(def.getValue(index), filterSets[def.key])) {
          return false;
        }
      }

      if (!matchesLastActiveRange(index.lastActiveDate, lastActiveRange)) {
        return false;
      }
      if (compositionOnly && !index.hasComposition) {
        return false;
      }

      return true;
    });
  }, [
    collectionMemberships,
    compositionOnly,
    filterSets,
    indexes,
    lastActiveRange,
    normalizedQuery,
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

  const collectionGroups = useMemo<IndexSection[]>(() => {
    const groups = new Map<string, IndexSection>();
    groupingOrder.forEach((collection) => {
      groups.set(collection.name, {
        key: collection.name,
        title: collection.title,
        indexes: [],
      });
    });

    const uncategorized: IndexSection = {
      key: UNCATEGORIZED_COLLECTION,
      title: t('moex.groups.uncategorized'),
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

    const orderedGroups: IndexSection[] = [];
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
    i18n.language,
    showFavoritesOnly,
    t,
    visibleFavorites,
    visibleOthers,
  ]);

  const sections = useMemo<IndexSection[]>(() => {
    if (showFavoritesOnly || favoriteIndexesAll.length === 0) {
      return collectionGroups;
    }
    return [
      {
        key: 'favorites',
        title: t('moex.list.favorites'),
        indexes: favoriteIndexesAll,
        showCollections: true,
      },
      ...collectionGroups,
    ];
  }, [collectionGroups, favoriteIndexesAll, i18n.language, showFavoritesOnly, t]);

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
    sections,
    foundCount,
    isEmpty: sortedIndexes.length === 0,
    showNoFavoritesMessage,
    pageCount,
    showPagination,
  };
}
