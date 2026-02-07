'use client';

import type { MoexIndex } from '@/lib/moex-client';
import { useMoexIndexesContext } from './moex-indexes-context';
import { IndexListItem } from './index-list-item';

type IndexListSectionProps = {
  title: string;
  indexes: MoexIndex[];
  showCollections?: boolean;
};

export function IndexListSection({
  title,
  indexes,
  showCollections = false,
}: IndexListSectionProps) {
  const {
    favoritesSet,
    selectedSecid,
    setSelectedSecid,
    toggleFavorite,
    indexCollectionsMap,
  } = useMoexIndexesContext();

  if (indexes.length === 0) return null;

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground'>
        <span>{title}</span>
        <span>{indexes.length}</span>
      </div>
      <div className='space-y-2'>
        {indexes.map((index) => (
          <IndexListItem
            key={index.secid}
            index={index}
            isActive={index.secid === selectedSecid}
            isFavorite={favoritesSet.has(index.secid.toUpperCase())}
            collectionTitles={
              indexCollectionsMap[index.secid.toUpperCase()] ?? []
            }
            showCollections={showCollections}
            onSelect={(secid) => setSelectedSecid(secid)}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}
