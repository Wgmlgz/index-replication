import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  moexClient,
  type MoexIndex,
  type MoexIndexCollection,
} from '@/lib/moex-client';
import {
  compareStrings,
  UNCATEGORIZED_COLLECTION,
} from './use-moex-indexes.utils';
import type { FilterOption } from './use-moex-indexes.types';

type CollectionsState = {
  groupingCollections: MoexIndexCollection[];
  collectionMemberships: Record<string, string[]>;
  indexCollectionsMap: Record<string, string[]>;
  collectionOptions: FilterOption[];
  collectionsLoading: boolean;
  collectionsError: boolean;
};

export function useMoexIndexCollections(
  indexes: MoexIndex[]
): CollectionsState {
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
      collections.filter((collection) => collection.name !== 'stock_index_all'),
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

  const collectionTitleByName = useMemo(() => {
    return new Map(
      groupingCollections.map((collection) => [
        collection.name,
        collection.title,
      ])
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

  const collectionsLoading =
    collectionsQuery.isLoading || membershipsQuery.isLoading;
  const collectionsError = Boolean(
    collectionsQuery.error || membershipsQuery.error
  );

  return {
    groupingCollections,
    collectionMemberships,
    indexCollectionsMap,
    collectionOptions,
    collectionsLoading,
    collectionsError,
  };
}
