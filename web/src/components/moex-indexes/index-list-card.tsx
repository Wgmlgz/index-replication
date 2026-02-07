'use client';

import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { MoexIndex } from '@/lib/moex-client';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

type IndexListCardProps = {
  query: string;
  onQueryChange: (value: string) => void;
  indexesLoading: boolean;
  showFavoritesOnly: boolean;
  onShowFavoritesOnlyChange: (value: boolean) => void;
  foundCount: number;
  isEmpty: boolean;
  showNoFavoritesMessage: boolean;
  favoriteIndexes: MoexIndex[];
  otherIndexes: MoexIndex[];
  favoritesSet: Set<string>;
  selectedSecid: string | null;
  onSelect: (secid: string) => void;
  onToggleFavorite: (secid: string) => void;
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  onPageIndexChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  showPagination: boolean;
};

type IndexListItemProps = {
  index: MoexIndex;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (secid: string) => void;
  onToggleFavorite: (secid: string) => void;
};

function IndexListItem({
  index,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: IndexListItemProps) {
  return (
    <div
      role='button'
      tabIndex={0}
      onClick={() => onSelect(index.secid)}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          onSelect(index.secid);
        }
      }}
      className={`w-full rounded-md border px-3 py-2 text-left transition ${
        isActive ? 'border-primary/60 bg-primary/10' : 'border-border hover:bg-muted'
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
            {index.secid} · {index.name}
          </div>
        </div>
        <button
          type='button'
          onClick={event => {
            event.stopPropagation();
            onToggleFavorite(index.secid);
          }}
          className='flex-shrink-0 rounded-full p-1 text-muted-foreground transition hover:text-amber-500'
          title='В избранное'
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`}
          />
        </button>
      </div>
    </div>
  );
}

type IndexListSectionProps = {
  title: string;
  indexes: MoexIndex[];
  favoritesSet: Set<string>;
  selectedSecid: string | null;
  onSelect: (secid: string) => void;
  onToggleFavorite: (secid: string) => void;
};

function IndexListSection({
  title,
  indexes,
  favoritesSet,
  selectedSecid,
  onSelect,
  onToggleFavorite,
}: IndexListSectionProps) {
  if (indexes.length === 0) return null;

  return (
    <div className='space-y-2'>
      <div className='text-[11px] uppercase tracking-wide text-muted-foreground'>
        {title}
      </div>
      <div className='space-y-2'>
        {indexes.map(index => (
          <IndexListItem
            key={index.secid}
            index={index}
            isActive={index.secid === selectedSecid}
            isFavorite={favoritesSet.has(index.secid.toUpperCase())}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

export function IndexListCard({
  query,
  onQueryChange,
  indexesLoading,
  showFavoritesOnly,
  onShowFavoritesOnlyChange,
  foundCount,
  isEmpty,
  showNoFavoritesMessage,
  favoriteIndexes,
  otherIndexes,
  favoritesSet,
  selectedSecid,
  onSelect,
  onToggleFavorite,
  pageIndex,
  pageCount,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  showPagination,
}: IndexListCardProps) {
  const canPreviousPage = pageIndex > 0;
  const canNextPage = pageIndex < pageCount - 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Список индексов</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <Input
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder='Поиск по названию или коду'
        />
        <div className='flex items-center justify-between text-xs text-muted-foreground'>
          <span>
            {indexesLoading ? 'Загрузка списка...' : `Найдено: ${foundCount}`}
          </span>
          <label className='flex items-center gap-2'>
            <span>Только избранное</span>
            <Switch
              checked={showFavoritesOnly}
              onCheckedChange={onShowFavoritesOnlyChange}
            />
          </label>
        </div>
        <ScrollArea className='h-[420px] pr-3'>
          <div className='space-y-4'>
            <IndexListSection
              title='Избранное'
              indexes={favoriteIndexes}
              favoritesSet={favoritesSet}
              selectedSecid={selectedSecid}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
            />

            {!showFavoritesOnly && (
              <IndexListSection
                title='Все индексы'
                indexes={otherIndexes}
                favoritesSet={favoritesSet}
                selectedSecid={selectedSecid}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
              />
            )}

            {!indexesLoading && isEmpty && (
              <div className='text-sm text-muted-foreground'>
                Ничего не найдено.
              </div>
            )}
            {!indexesLoading && showNoFavoritesMessage && (
              <div className='text-sm text-muted-foreground'>
                Нет избранных индексов по вашему запросу.
              </div>
            )}
          </div>
        </ScrollArea>
        {showPagination && (
          <div className='flex flex-wrap items-center gap-3 pt-3 text-xs text-muted-foreground'>
            <div className='flex items-center gap-2'>
              <span>Строк на странице</span>
              <Select
                value={`${pageSize}`}
                onValueChange={value => onPageSizeChange(Number(value))}
              >
                <SelectTrigger size='sm'>
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side='top'>
                  {PAGE_SIZE_OPTIONS.map(option => (
                    <SelectItem key={option} value={`${option}`}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='text-xs font-medium text-foreground'>
              {pageIndex + 1} из {pageCount}
            </div>
            <div className='ml-auto flex items-center gap-2'>
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                onClick={() =>
                  onPageIndexChange(Math.max(0, pageIndex - 1))
                }
                disabled={!canPreviousPage}
              >
                <span className='sr-only'>Предыдущая страница</span>
                <ChevronLeft />
              </Button>
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                onClick={() =>
                  onPageIndexChange(Math.min(pageCount - 1, pageIndex + 1))
                }
                disabled={!canNextPage}
              >
                <span className='sr-only'>Следующая страница</span>
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
