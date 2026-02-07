'use client';

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMoexIndexesContext } from './moex-indexes-context';
import type { SortKey } from './use-moex-indexes.types';

type FilterMenuProps = {
  label: string;
  options: Array<{ value: string; label: string; count?: number }>;
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

export function IndexListFilters() {
  const {
    collectionOptions,
    selectedCollections,
    setSelectedCollections,
    currencyOptions,
    selectedCurrencies,
    setSelectedCurrencies,
    boardOptions,
    selectedBoards,
    setSelectedBoards,
    calcModeOptions,
    selectedCalcModes,
    setSelectedCalcModes,
    sortKey,
    setSortKey,
    sortOptions,
    hasActiveFilters,
    clearFilters,
    indexesLoading,
    collectionsLoading,
  } = useMoexIndexesContext();

  const filtersDisabled = indexesLoading;
  const groupsDisabled = indexesLoading || collectionsLoading;

  return (
    <>
      <div className='flex flex-wrap items-center gap-2'>
        <FilterMenu
          label='Группы'
          options={collectionOptions}
          selected={selectedCollections}
          onChange={setSelectedCollections}
          disabled={groupsDisabled}
        />
        <FilterMenu
          label='Валюта'
          options={currencyOptions}
          selected={selectedCurrencies}
          onChange={setSelectedCurrencies}
          disabled={filtersDisabled}
        />
        <FilterMenu
          label='Board'
          options={boardOptions}
          selected={selectedBoards}
          onChange={setSelectedBoards}
          disabled={filtersDisabled}
        />
        <FilterMenu
          label='Тип'
          options={calcModeOptions}
          selected={selectedCalcModes}
          onChange={setSelectedCalcModes}
          disabled={filtersDisabled}
        />
        <div className='flex items-center gap-2'>
          <span className='text-xs text-muted-foreground'>Сортировка</span>
          <Select
            value={sortKey}
            onValueChange={(value) => setSortKey(value as SortKey)}
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
            onClick={clearFilters}
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
    </>
  );
}
