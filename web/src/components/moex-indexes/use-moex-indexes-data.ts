'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moexClient, type MoexIndex } from '@/lib/moex-client';
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
    indexesLoading: indexesQuery.isLoading,
    indexesError: Boolean(indexesQuery.error),
    favorites,
    favoritesSet,
    favoritesBySecid,
    toggleFavorite,
    settingsError: Boolean(settingsQuery.error),
    groupingCollections,
    collectionMemberships,
    indexCollectionsMap,
    collectionOptions,
    collectionsLoading,
    collectionsError,
  };
}
