'use client';

import { useMemo } from 'react';
import type { MoexIndex } from '@/api-client';
import type { MoexIndexDetailState } from './moex-indexes-detail.types';

type UseMoexSelectedIndexInput = {
  indexes: MoexIndex[];
  favorites: string[];
  favoritesBySecid: MoexIndex[];
  selectedSecid: string | null;
  indexCollectionsMap: Record<string, string[]>;
};

export function useMoexSelectedIndex({
  indexes,
  favorites,
  favoritesBySecid,
  selectedSecid,
  indexCollectionsMap,
}: UseMoexSelectedIndexInput): MoexIndexDetailState {
  const selectedIndex = useMemo<MoexIndex | null>(() => {
    const findIndex = (secid: string) => {
      const key = secid.toUpperCase();
      return (
        favoritesBySecid.find((item) => (item.secid ?? '').toUpperCase() === key) ??
        indexes.find((item) => (item.secid ?? '').toUpperCase() === key) ??
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

    const fallbackFavorite = favoritesBySecid.find((item) => Boolean(item.secid));
    const fallbackIndex = indexes.find((item) => Boolean(item.secid));
    return findIndex('IMOEX') ?? fallbackFavorite ?? fallbackIndex ?? null;
  }, [favorites, favoritesBySecid, indexes, selectedSecid]);

  const selectedIndexCollections = useMemo(() => {
    const secid = selectedIndex?.secid?.toUpperCase();
    if (!secid) return [];
    return indexCollectionsMap[secid] ?? [];
  }, [indexCollectionsMap, selectedIndex?.secid]);

  return {
    selectedIndex,
    selectedIndexCollections,
    error: null,
  };
}
