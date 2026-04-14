'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useMoexIndexListContext } from './moex-indexes-list-context';
import { IndexListFilters } from './index-list-filters';
import { IndexListPagination } from './index-list-pagination';
import { IndexListSection } from './index-list-section';

type IndexListBrowserProps = {
  footer?: ReactNode;
};

export function IndexListBrowser({ footer }: IndexListBrowserProps) {
  const {
    query,
    setQuery,
    indexesLoading,
    showFavoritesOnly,
    setShowFavoritesOnly,
    compositionOnly,
    setCompositionOnly,
    foundCount,
    isEmpty,
    showNoFavoritesMessage,
    listSections,
  } = useMoexIndexListContext();
  const { t } = useTranslation();
  const showListSkeleton = indexesLoading && listSections.length === 0;

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('moex.list.searchPlaceholder')}
      />
      <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
        {showListSkeleton ? (
          <Skeleton className='h-4 w-28' />
        ) : (
          <span>{t('moex.list.found', { count: foundCount })}</span>
        )}
        <div className='flex items-center gap-3'>
          <label className='flex items-center gap-2'>
            <span>{t('moex.list.onlyFavorites')}</span>
            <Switch
              checked={showFavoritesOnly}
              onCheckedChange={setShowFavoritesOnly}
            />
          </label>
          <label className='flex items-center gap-2'>
            <span>{t('moex.filters.compositionOnly')}</span>
            <Switch
              checked={compositionOnly}
              onCheckedChange={setCompositionOnly}
            />
          </label>
        </div>
      </div>
      <IndexListFilters />
      <ScrollArea className='min-h-0 flex-1 pr-3'>
        {showListSkeleton ? (
          <div className='space-y-3'>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={`moex-list-skeleton-${index}`}
                className='h-8 w-full'
              />
            ))}
          </div>
        ) : (
          <div className='space-y-4'>
            {listSections.map((section) => (
              <IndexListSection
                key={section.key}
                title={section.title}
                indexes={section.indexes}
                showCollections={section.showCollections}
              />
            ))}

            {!indexesLoading && isEmpty && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.list.empty')}
              </div>
            )}
            {!indexesLoading && showNoFavoritesMessage && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.list.noFavorites')}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      <IndexListPagination />
      {footer}
    </div>
  );
}
