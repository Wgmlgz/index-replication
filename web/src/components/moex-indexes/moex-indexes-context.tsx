'use client';

import type { ReactNode } from 'react';
import { MoexIndexDetailProvider } from './detail/moex-indexes-detail-context';
import { useMoexIndexDetailState } from './detail/use-moex-indexes-detail-state';
import { MoexIndexListProvider } from './list/moex-indexes-list-context';
import { useMoexIndexListState } from './list/use-moex-indexes-list-state';
import { useMoexIndexesData } from './use-moex-indexes-data';

export function MoexIndexesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const dataState = useMoexIndexesData();
  const listState = useMoexIndexListState({
    indexes: dataState.indexes,
    indexesLoading: dataState.indexesLoading,
    indexesError: dataState.indexesError,
    settingsError: dataState.settingsError,
    collectionMemberships: dataState.collectionMemberships,
    groupingCollections: dataState.groupingCollections,
    indexCollectionsMap: dataState.indexCollectionsMap,
    collectionOptions: dataState.collectionOptions,
    collectionsLoading: dataState.collectionsLoading,
    collectionsError: dataState.collectionsError,
    favoritesSet: dataState.favoritesSet,
    toggleFavorite: dataState.toggleFavorite,
  });
  const detailState = useMoexIndexDetailState({
    indexes: dataState.indexes,
    favorites: dataState.favorites,
    favoritesBySecid: dataState.favoritesBySecid,
    selectedSecid: listState.selectedSecid,
    indexCollectionsMap: dataState.indexCollectionsMap,
  });
  return (
    <MoexIndexListProvider value={listState}>
      <MoexIndexDetailProvider value={detailState}>
        {children}
      </MoexIndexDetailProvider>
    </MoexIndexListProvider>
  );
}
