'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { CompositionCompareRow, CompositionCompareSummary } from './types';

type CompositionCompareTableProps = {
  loading: boolean;
  hasError: boolean;
  noDataMessage: string;
  rows: CompositionCompareRow[];
  summary: CompositionCompareSummary;
};

const formatPercent = (value: number): string => `${value.toFixed(2)}%`;

export function CompositionCompareTable({
  loading,
  hasError,
  noDataMessage,
  rows,
  summary,
}: CompositionCompareTableProps) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);

  const formatStatus = useCallback(
    (status: CompositionCompareRow['status']): string =>
      t(`portfolio.composition.compare.status.${status}`),
    [t],
  );

  const signedPercentClassName = (value: number): string => {
    if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-foreground';
  };

  const renderSortIcon = (sorted: false | 'asc' | 'desc') => {
    if (sorted === 'asc') return <ArrowUp className='size-4' />;
    if (sorted === 'desc') return <ArrowDown className='size-4' />;
    return <ArrowUpDown className='size-4' />;
  };

  const columns = useMemo<ColumnDef<CompositionCompareRow>[]>(
    () => [
      {
        accessorKey: 'ticker',
        header: ({ column }) => (
          <Button
            variant='ghost'
            size='sm'
            className='-ml-3 h-8'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('portfolio.composition.compare.columns.ticker')}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => <span className='font-medium'>{row.original.ticker}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <Button
            variant='ghost'
            size='sm'
            className='-ml-3 h-8'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('portfolio.composition.compare.columns.name')}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
      },
      {
        accessorKey: 'portfolioWeight',
        header: ({ column }) => (
          <div className='text-right'>
            <Button
              variant='ghost'
              size='sm'
              className='-ml-3 h-8'
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              {t('portfolio.composition.compare.columns.portfolioWeight')}
              {renderSortIcon(column.getIsSorted())}
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              'text-right font-medium',
              signedPercentClassName(row.original.portfolioWeight),
            )}
          >
            {formatPercent(row.original.portfolioWeight)}
          </div>
        ),
      },
      {
        accessorKey: 'benchmarkWeight',
        header: ({ column }) => (
          <div className='text-right'>
            <Button
              variant='ghost'
              size='sm'
              className='-ml-3 h-8'
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              {t('portfolio.composition.compare.columns.benchmarkWeight')}
              {renderSortIcon(column.getIsSorted())}
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              'text-right font-medium',
              signedPercentClassName(row.original.benchmarkWeight),
            )}
          >
            {formatPercent(row.original.benchmarkWeight)}
          </div>
        ),
      },
      {
        accessorKey: 'activeWeight',
        header: ({ column }) => (
          <div className='text-right'>
            <Button
              variant='ghost'
              size='sm'
              className='-ml-3 h-8'
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              {t('portfolio.composition.compare.columns.activeWeight')}
              {renderSortIcon(column.getIsSorted())}
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              'text-right font-medium',
              signedPercentClassName(row.original.activeWeight),
            )}
          >
            {formatPercent(row.original.activeWeight)}
          </div>
        ),
      },
      {
        accessorKey: 'absActive',
        header: ({ column }) => (
          <div className='text-right'>
            <Button
              variant='ghost'
              size='sm'
              className='-ml-3 h-8'
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              {t('portfolio.composition.compare.columns.absActive')}
              {renderSortIcon(column.getIsSorted())}
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              'text-right font-medium',
              signedPercentClassName(row.original.absActive),
            )}
          >
            {formatPercent(row.original.absActive)}
          </div>
        ),
      },
      {
        accessorKey: 'contributionPct',
        header: ({ column }) => (
          <div className='text-right'>
            <Button
              variant='ghost'
              size='sm'
              className='-ml-3 h-8'
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              {t('portfolio.composition.compare.columns.errorContribution')}
              {renderSortIcon(column.getIsSorted())}
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div
            className={cn(
              'text-right font-medium',
              signedPercentClassName(row.original.contributionPct),
            )}
          >
            {formatPercent(row.original.contributionPct)}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <Button
            variant='ghost'
            size='sm'
            className='-ml-3 h-8'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {t('portfolio.composition.compare.columns.status')}
            {renderSortIcon(column.getIsSorted())}
          </Button>
        ),
        cell: ({ row }) => formatStatus(row.original.status),
      },
    ],
    [formatStatus, t],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    getRowId: row => row.key,
  });

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden'>
      {loading && (
        <div className='text-sm text-muted-foreground'>
          {t('portfolio.composition.compare.loading')}
        </div>
      )}
      {!loading && hasError && (
        <div className='text-sm text-muted-foreground'>
          {t('portfolio.composition.error')}
        </div>
      )}
      {!loading && !hasError && rows.length === 0 && (
        <div className='text-sm text-muted-foreground'>{noDataMessage}</div>
      )}
      {!loading && !hasError && rows.length > 0 && (
        <>
          <div className='grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3'>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.trackingError')}:{' '}
              <span className='font-medium text-foreground'>
                {formatPercent(summary.trackingError)}
              </span>
            </div>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.meanAbsActive')}:{' '}
              <span className='font-medium text-foreground'>
                {formatPercent(summary.meanAbsActive)}
              </span>
            </div>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.overlap')}:{' '}
              <span className='font-medium text-foreground'>
                {formatPercent(summary.overlap)}
              </span>
            </div>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.overweightCount')}:{' '}
              <span className='font-medium text-foreground'>
                {summary.overweightCount}
              </span>
            </div>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.underweightCount')}:{' '}
              <span className='font-medium text-foreground'>
                {summary.underweightCount}
              </span>
            </div>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.missingCount')}:{' '}
              <span className='font-medium text-foreground'>
                {summary.portfolioOnlyCount + summary.benchmarkOnlyCount}
              </span>
            </div>
          </div>

          <div className='min-h-0 flex-1 overflow-auto rounded border'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map(row => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
