'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useMoexIndexListContext } from './moex-indexes-list-context';
import { IndexListFilters } from './index-list-filters';
import { IndexListPagination } from './index-list-pagination';
import { IndexListSection } from './index-list-section';

export function IndexListCard() {
  const {
    query,
    setQuery,
    indexesLoading,
    showFavoritesOnly,
    setShowFavoritesOnly,
    foundCount,
    isEmpty,
    showNoFavoritesMessage,
    listSections,
  } = useMoexIndexListContext();
  const { t } = useTranslation();

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader>
        <CardTitle>{t('moex.list.title')}</CardTitle>
      </CardHeader>
      <CardContent className='flex h-full min-h-0 flex-col gap-3'>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('moex.list.searchPlaceholder')}
        />
        <div className='flex items-center justify-between text-xs text-muted-foreground'>
          <span>
            {indexesLoading
              ? t('moex.list.loading')
              : t('moex.list.found', { count: foundCount })}
          </span>
          <label className='flex items-center gap-2'>
            <span>{t('moex.list.onlyFavorites')}</span>
            <Switch
              checked={showFavoritesOnly}
              onCheckedChange={setShowFavoritesOnly}
            />
          </label>
        </div>
        <IndexListFilters />
        <ScrollArea className='min-h-0 flex-1 pr-3'>
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
        </ScrollArea>
        <IndexListPagination />
      </CardContent>
    </Card>
  );
}
