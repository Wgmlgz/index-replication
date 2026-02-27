'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MoexIndex as MoexIndex } from '@/api-client';
import { moexApi } from '@/lib/api';
import {
  userSettingsClient,
  type UserSettings,
} from '@/lib/user-settings-client';
import { useMoexIndexCollections } from './list/use-moex-indexes-collections';

type MoexIndexesDataState = {
  indexes: MoexIndex[];
  indexesLoading: boolean;
  indexesError: boolean;
  favorites: string[];
  favoritesSet: Set<string>;
  favoritesBySecid: MoexIndex[];
  toggleFavorite: (secid: string) => void;
  settingsError: boolean;
  groupingCollections: ReturnType<typeof useMoexIndexCollections>['groupingCollections'];
  collectionMemberships: ReturnType<typeof useMoexIndexCollections>['collectionMemberships'];
  indexCollectionsMap: ReturnType<typeof useMoexIndexCollections>['indexCollectionsMap'];
  collectionOptions: ReturnType<typeof useMoexIndexCollections>['collectionOptions'];
  collectionsLoading: boolean;
  collectionsError: boolean;
};

export function useMoexIndexesData(): MoexIndexesDataState {
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ['moex-indexes-overview', 'ru'],
    queryFn: async () => {
      const response = await moexApi.moexIndexesOverviewGet('ru');
      return response.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const overview = overviewQuery.data;
  const indexes = useMemo(() => overview?.indexes ?? [], [overview?.indexes]);
  const collections = useMemo(
    () => overview?.collections ?? [],
    [overview?.collections]
  );
  const memberships = useMemo(
    () => overview?.memberships ?? {},
    [overview?.memberships]
  );

  const {
    groupingCollections,
    collectionMemberships,
    indexCollectionsMap,
    collectionOptions,
  } = useMoexIndexCollections(indexes, collections, memberships);

  const settingsQuery = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => userSettingsClient.getSettings(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const favorites = useMemo(
    () => settingsQuery.data?.favorites ?? [],
    [settingsQuery.data?.favorites]
  );
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

  return {
    indexes,
    indexesLoading: overviewQuery.isLoading,
    indexesError: Boolean(overviewQuery.error),
    favorites,
    favoritesSet,
    favoritesBySecid,
    toggleFavorite,
    settingsError: Boolean(settingsQuery.error),
    groupingCollections,
    collectionMemberships,
    indexCollectionsMap,
    collectionOptions,
    collectionsLoading: overviewQuery.isLoading,
    collectionsError: Boolean(overviewQuery.error),
  };
}
