'use client';

import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ModelsMoexIndex as MoexIndex } from '@/api-client';
import { isIndexInactive } from '@/components/moex-indexes/moex-indexes-activity';
import { useMoexIndexListContext } from './moex-indexes-list-context';

type IndexListItemProps = {
  index: MoexIndex;
  showCollections: boolean;
};

export function IndexListItem({ index, showCollections }: IndexListItemProps) {
  const {
    favoritesSet,
    selectedSecid,
    setSelectedSecid,
    toggleFavorite,
    indexCollectionsMap,
  } = useMoexIndexListContext();
  const { t } = useTranslation();

  const secidKey = (index.secid ?? '').toUpperCase();
  const isActive = index.secid === selectedSecid;
  const isFavorite = favoritesSet.has(secidKey);
  const isInactive = isIndexInactive(index.lastActiveDate);
  const collectionTitles = showCollections
    ? (indexCollectionsMap[secidKey] ?? [])
    : [];

  const previewCollections = showCollections
    ? collectionTitles.slice(0, 2)
    : [];
  const remainingCollections =
    showCollections && collectionTitles.length > 2
      ? collectionTitles.length - 2
      : 0;

  return (
    <div
      role='button'
      tabIndex={0}
      onClick={() => setSelectedSecid(index.secid ?? null)}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          setSelectedSecid(index.secid ?? null);
        }
      }}
      className={`w-full rounded-md border px-3 py-2 text-left transition ${
        isActive
          ? 'border-primary/60 bg-primary/10'
          : 'border-transparent hover:bg-muted'
      }`}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <div
            className='text-sm font-medium whitespace-normal'
            style={{
              overflowWrap: 'anywhere',
              wordBreak: 'normal',
              hyphens: 'auto',
            }}
          >
            {index.shortName || index.name}
          </div>
          <div className='text-xs text-muted-foreground'>
            {index.name
              ? t('moex.list.codeWithName', {
                  secid: index.secid,
                  name: index.name,
                })
              : t('moex.list.codeOnly', { secid: index.secid })}
          </div>
          <div className='mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground'>
            {index.currency && (
              <Badge variant='secondary'>{index.currency}</Badge>
            )}
            {index.boardId && (
              <Badge variant='outline'>Board {index.boardId}</Badge>
            )}
            {index.calcMode && (
              <Badge variant='outline'>{index.calcMode}</Badge>
            )}
            {isInactive && index.lastActiveDate && (
              <Badge
                variant='outline'
                className='border-amber-300/80 text-amber-700'
              >
                {t('moex.status.inactiveSince', { date: index.lastActiveDate })}
              </Badge>
            )}
          </div>
          {showCollections && previewCollections.length > 0 && (
            <div className='mt-1 text-[11px] text-muted-foreground'>
              {previewCollections.join(', ')}
              {remainingCollections > 0 && ` +${remainingCollections}`}
            </div>
          )}
        </div>
        <button
          type='button'
          onClick={event => {
            event.stopPropagation();
            toggleFavorite(index.secid);
          }}
          className='flex-shrink-0 rounded-full p-1 text-muted-foreground transition hover:text-amber-500'
          title={t('moex.list.addFavorite')}
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`}
          />
        </button>
      </div>
    </div>
  );
}
