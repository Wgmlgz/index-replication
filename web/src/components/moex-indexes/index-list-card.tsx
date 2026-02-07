'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

type SortOption = {
  value: SortKey;
  label: string;
};

type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'secid-asc'
  | 'secid-desc'
  | 'currency-asc'
  | 'board-asc'
  | 'calc-asc';

type IndexGroup = {
  key: string;
  title: string;
  indexes: MoexIndex[];
};

type IndexListCardProps = {
  query: string;
  onQueryChange: (value: string) => void;
  indexesLoading: boolean;
  collectionsLoading: boolean;
  showFavoritesOnly: boolean;
  onShowFavoritesOnlyChange: (value: boolean) => void;
  collectionOptions: FilterOption[];
  selectedCollections: string[];
  onSelectedCollectionsChange: (value: string[]) => void;
  currencyOptions: FilterOption[];
  selectedCurrencies: string[];
  onSelectedCurrenciesChange: (value: string[]) => void;
  boardOptions: FilterOption[];
  selectedBoards: string[];
  onSelectedBoardsChange: (value: string[]) => void;
  calcModeOptions: FilterOption[];
  selectedCalcModes: string[];
  onSelectedCalcModesChange: (value: string[]) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  sortOptions: SortOption[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  foundCount: number;
  isEmpty: boolean;
  showNoFavoritesMessage: boolean;
  favoriteIndexes: MoexIndex[];
  collectionGroups: IndexGroup[];
  indexCollectionsMap: Record<string, string[]>;
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
  collectionTitles: string[];
  showCollections: boolean;
  onSelect: (secid: string) => void;
  onToggleFavorite: (secid: string) => void;
};

function IndexListItem({
  index,
  isActive,
  isFavorite,
  collectionTitles,
  showCollections,
  onSelect,
  onToggleFavorite,
}: IndexListItemProps) {
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
            {index.secid}
            {index.name ? ` · ${index.name}` : ''}
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
  indexCollectionsMap: Record<string, string[]>;
  showCollections: boolean;
  favoritesSet: Set<string>;
  selectedSecid: string | null;
  onSelect: (secid: string) => void;
  onToggleFavorite: (secid: string) => void;
};

function IndexListSection({
  title,
  indexes,
  indexCollectionsMap,
  showCollections,
  favoritesSet,
  selectedSecid,
  onSelect,
  onToggleFavorite,
}: IndexListSectionProps) {
  if (indexes.length === 0) return null;

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground'>
        <span>{title}</span>
        <span>{indexes.length}</span>
      </div>
      <div className='space-y-2'>
        {indexes.map(index => (
          <IndexListItem
            key={index.secid}
            index={index}
            isActive={index.secid === selectedSecid}
            isFavorite={favoritesSet.has(index.secid.toUpperCase())}
            collectionTitles={
              indexCollectionsMap[index.secid.toUpperCase()] ?? []
            }
            showCollections={showCollections}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

type FilterMenuProps = {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

function FilterMenu({
  label,
  options,
  selected,
  onChange,
  disabled,
}: FilterMenuProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (value: string, checked: boolean) => {
    const next = new Set(selectedSet);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    onChange(Array.from(next));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='justify-between gap-2'
          disabled={disabled}
        >
          <span>{label}</span>
          {selected.length > 0 && (
            <Badge variant='secondary'>{selected.length}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-64'>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.length === 0 && (
          <div className='px-2 py-1.5 text-sm text-muted-foreground'>
            Нет доступных значений
          </div>
        )}
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedSet.has(option.value)}
            onCheckedChange={(checked) => toggle(option.value, Boolean(checked))}
          >
            <span className='flex w-full items-center justify-between gap-3'>
              <span className='truncate'>{option.label}</span>
              {typeof option.count === 'number' && (
                <span className='text-xs text-muted-foreground'>
                  {option.count}
                </span>
              )}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IndexListCard({
  query,
  onQueryChange,
  indexesLoading,
  collectionsLoading,
  showFavoritesOnly,
  onShowFavoritesOnlyChange,
  collectionOptions,
  selectedCollections,
  onSelectedCollectionsChange,
  currencyOptions,
  selectedCurrencies,
  onSelectedCurrenciesChange,
  boardOptions,
  selectedBoards,
  onSelectedBoardsChange,
  calcModeOptions,
  selectedCalcModes,
  onSelectedCalcModesChange,
  sortKey,
  onSortKeyChange,
  sortOptions,
  hasActiveFilters,
  onClearFilters,
  foundCount,
  isEmpty,
  showNoFavoritesMessage,
  favoriteIndexes,
  collectionGroups,
  indexCollectionsMap,
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
  const filtersDisabled = indexesLoading;
  const groupsDisabled = indexesLoading || collectionsLoading;

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader>
        <CardTitle>Список индексов</CardTitle>
      </CardHeader>
      <CardContent className='flex h-full min-h-0 flex-col gap-3'>
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
        <div className='flex flex-wrap items-center gap-2'>
          <FilterMenu
            label='Группы'
            options={collectionOptions}
            selected={selectedCollections}
            onChange={onSelectedCollectionsChange}
            disabled={groupsDisabled}
          />
          <FilterMenu
            label='Валюта'
            options={currencyOptions}
            selected={selectedCurrencies}
            onChange={onSelectedCurrenciesChange}
            disabled={filtersDisabled}
          />
          <FilterMenu
            label='Board'
            options={boardOptions}
            selected={selectedBoards}
            onChange={onSelectedBoardsChange}
            disabled={filtersDisabled}
          />
          <FilterMenu
            label='Тип'
            options={calcModeOptions}
            selected={selectedCalcModes}
            onChange={onSelectedCalcModesChange}
            disabled={filtersDisabled}
          />
          <div className='flex items-center gap-2'>
            <span className='text-xs text-muted-foreground'>Сортировка</span>
            <Select
              value={sortKey}
              onValueChange={(value) => onSortKeyChange(value as SortKey)}
            >
              <SelectTrigger size='sm'>
                <SelectValue placeholder='Сортировка' />
              </SelectTrigger>
              <SelectContent side='bottom'>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasActiveFilters && (
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground'
              onClick={onClearFilters}
            >
              Сбросить фильтры
            </Button>
          )}
        </div>
        {collectionsLoading && !indexesLoading && (
          <div className='text-xs text-muted-foreground'>
            Загружаем группы индексов...
          </div>
        )}
        <ScrollArea className='min-h-0 flex-1 pr-3'>
          <div className='space-y-4'>
            {!showFavoritesOnly && (
              <IndexListSection
                title='Избранное'
                indexes={favoriteIndexes}
                indexCollectionsMap={indexCollectionsMap}
                showCollections
                favoritesSet={favoritesSet}
                selectedSecid={selectedSecid}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
              />
            )}

            {collectionGroups.map((group) => (
              <IndexListSection
                key={group.key}
                title={group.title}
                indexes={group.indexes}
                indexCollectionsMap={indexCollectionsMap}
                showCollections={false}
                favoritesSet={favoritesSet}
                selectedSecid={selectedSecid}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
              />
            ))}

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
