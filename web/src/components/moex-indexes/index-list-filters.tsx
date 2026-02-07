'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { FILTER_DEFS } from './use-moex-indexes.utils';

type FilterMenuProps = {
  label: string;
  emptyMessage: string;
  options: Array<{ value: string; label: string; count?: number }>;
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

function FilterMenu({
  label,
  emptyMessage,
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
            {emptyMessage}
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
    filters,
    setFilter,
    filterOptions,
    sortKey,
    setSortKey,
    sortOptions,
    hasActiveFilters,
    clearFilters,
    indexesLoading,
    collectionsLoading,
  } = useMoexIndexesContext();
  const { t } = useTranslation();

  const filtersDisabled = indexesLoading;
  const groupsDisabled = indexesLoading || collectionsLoading;

  return (
    <>
      <div className='flex flex-wrap items-center gap-2'>
        {FILTER_DEFS.map((def) => (
          <FilterMenu
            key={def.key}
            label={t(def.labelKey)}
            emptyMessage={t('moex.filters.emptyValues')}
            options={filterOptions[def.key] ?? []}
            selected={filters[def.key]}
            onChange={(next) => setFilter(def.key, next)}
            disabled={def.key === 'collections' ? groupsDisabled : filtersDisabled}
          />
        ))}
        <div className='flex items-center gap-2'>
          <span className='text-xs text-muted-foreground'>
            {t('moex.filters.sort')}
          </span>
          <Select
            value={sortKey}
            onValueChange={(value) => setSortKey(value as SortKey)}
          >
            <SelectTrigger size='sm'>
              <SelectValue placeholder={t('moex.filters.sort')} />
            </SelectTrigger>
            <SelectContent side='bottom'>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
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
            {t('moex.filters.clear')}
          </Button>
        )}
      </div>
      {collectionsLoading && !indexesLoading && (
        <div className='text-xs text-muted-foreground'>
          {t('moex.filters.loadingGroups')}
        </div>
      )}
    </>
  );
}
