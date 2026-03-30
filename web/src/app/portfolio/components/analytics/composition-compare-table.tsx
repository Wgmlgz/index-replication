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
import { useTheme } from 'next-themes';
import { SortHeader } from '@/app/portfolio/components/sortable-data-table';
import { TickerWithLogo } from '@/components/ticker/ticker-with-logo';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CompositionCompareRow, CompositionCompareSummary } from './types';
import {
  boundedPercentDivergingColorStyle,
  boundedPercentColorStyle,
  gradientColorStyle,
  resolveCompositionCompareColorScale,
  signedPercentGradientColorStyle,
} from './composition-compare-colors';

type CompositionCompareTableProps = {
  loading: boolean;
  hasError: boolean;
  noDataMessage: string;
  rows: CompositionCompareRow[];
  summary: CompositionCompareSummary;
};

const formatPercent = (value: number): string => `${value.toFixed(2)}%`;
const METRIC_CELL_CLASS = 'rounded-sm px-2 py-0.5 text-right font-medium tabular-nums';

export function CompositionCompareTable({
  loading,
  hasError,
  noDataMessage,
  rows,
  summary,
}: CompositionCompareTableProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [sorting, setSorting] = useState<SortingState>([]);
  const colorScale = useMemo(() => resolveCompositionCompareColorScale(), [resolvedTheme]);

  const formatStatus = useCallback(
    (status: CompositionCompareRow['status']): string =>
      t(`portfolio.composition.compare.status.${status}`),
    [t],
  );

  const scales = useMemo(() => {
    let maxPortfolioWeight = 0;
    let maxBenchmarkWeight = 0;
    let maxAbsActive = 0;
    let maxAbsActiveWeight = 0;
    let maxAbsContribution = 0;

    for (const row of rows) {
      maxPortfolioWeight = Math.max(maxPortfolioWeight, Math.abs(row.portfolioWeight));
      maxBenchmarkWeight = Math.max(maxBenchmarkWeight, Math.abs(row.benchmarkWeight));
      maxAbsActive = Math.max(maxAbsActive, row.absActive);
      maxAbsActiveWeight = Math.max(maxAbsActiveWeight, Math.abs(row.activeWeight));
      maxAbsContribution = Math.max(maxAbsContribution, Math.abs(row.contributionPct));
    }

    return {
      maxPortfolioWeight: maxPortfolioWeight || 1,
      maxBenchmarkWeight: maxBenchmarkWeight || 1,
      maxAbsActive: maxAbsActive || 1,
      maxAbsActiveWeight: maxAbsActiveWeight || 1,
      maxAbsContribution: maxAbsContribution || 1,
    };
  }, [rows]);

  const columns = useMemo<ColumnDef<CompositionCompareRow>[]>(
    () => [
      {
        accessorKey: 'ticker',
        header: ({ column }) => (
          <SortHeader
            column={column}
            label={t('portfolio.composition.compare.columns.ticker')}
          />
        ),
        cell: ({ row }) => (
          <TickerWithLogo ticker={row.original.ticker} textClassName='font-medium' />
        ),
      },
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortHeader
            column={column}
            label={t('portfolio.composition.compare.columns.name')}
          />
        ),
      },
      {
        accessorKey: 'portfolioWeight',
        header: ({ column }) => (
          <SortHeader
            column={column}
            label={t('portfolio.composition.compare.columns.portfolioWeight')}
            alignRight
          />
        ),
        cell: ({ row }) => (
          <div
            className={METRIC_CELL_CLASS}
            style={gradientColorStyle(
              Math.abs(row.original.portfolioWeight) / scales.maxPortfolioWeight,
              colorScale.baseMetric,
            )}
          >
            {formatPercent(row.original.portfolioWeight)}
          </div>
        ),
      },
      {
        accessorKey: 'benchmarkWeight',
        header: ({ column }) => (
          <SortHeader
            column={column}
            label={t('portfolio.composition.compare.columns.benchmarkWeight')}
            alignRight
          />
        ),
        cell: ({ row }) => (
          <div
            className={METRIC_CELL_CLASS}
            style={gradientColorStyle(
              Math.abs(row.original.benchmarkWeight) / scales.maxBenchmarkWeight,
              colorScale.baseMetric,
            )}
          >
            {formatPercent(row.original.benchmarkWeight)}
          </div>
        ),
      },
      {
        accessorKey: 'activeWeight',
        header: ({ column }) => (
          <SortHeader
            column={column}
            label={t('portfolio.composition.compare.columns.activeWeight')}
            alignRight
          />
        ),
        cell: ({ row }) => (
          <div
            className={METRIC_CELL_CLASS}
            style={signedPercentGradientColorStyle(
              row.original.activeWeight,
              colorScale.activeWeight,
              scales.maxAbsActiveWeight,
            )}
          >
            {formatPercent(row.original.activeWeight)}
          </div>
        ),
      },
      {
        accessorKey: 'absActive',
        header: ({ column }) => (
          <SortHeader
            column={column}
            label={t('portfolio.composition.compare.columns.absActive')}
            alignRight
          />
        ),
        cell: ({ row }) => (
          <div
            className={METRIC_CELL_CLASS}
            style={gradientColorStyle(
              row.original.absActive / scales.maxAbsActive,
              colorScale.baseMetric,
            )}
          >
            {formatPercent(row.original.absActive)}
          </div>
        ),
      },
      {
        accessorKey: 'contributionPct',
        header: ({ column }) => (
          <SortHeader
            column={column}
            label={t('portfolio.composition.compare.columns.errorContribution')}
            alignRight
          />
        ),
        cell: ({ row }) => (
          <div
            className={METRIC_CELL_CLASS}
            style={signedPercentGradientColorStyle(
              row.original.contributionPct,
              colorScale.contributionPct,
              scales.maxAbsContribution,
            )}
          >
            {formatPercent(row.original.contributionPct)}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <SortHeader
            column={column}
            label={t('portfolio.composition.compare.columns.status')}
          />
        ),
        cell: ({ row }) => formatStatus(row.original.status),
      },
    ],
    [colorScale, formatStatus, scales, t],
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
        <div className='h-full flex flex-col gap-4'>
          <div className='grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3'>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.trackingError')}:{' '}
              <span
                className='font-medium'
                style={boundedPercentColorStyle(
                  summary.trackingError,
                  colorScale.summaryHigherIsWorse,
                )}
              >
                {formatPercent(summary.trackingError)}
              </span>
            </div>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.meanAbsActive')}:{' '}
              <span
                className='font-medium'
                style={boundedPercentColorStyle(
                  summary.meanAbsActive,
                  colorScale.summaryHigherIsWorse,
                )}
              >
                {formatPercent(summary.meanAbsActive)}
              </span>
            </div>
            <div className='rounded border p-2'>
              {t('portfolio.composition.compare.summary.overlap')}:{' '}
              <span
                className='font-medium'
                style={boundedPercentDivergingColorStyle(
                  summary.overlap,
                  colorScale.summaryOverlap,
                )}
              >
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

          <div className='relative h-full rounded border overflow-auto'>
            <div className='absolute inset-0'>
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

          </div>
        </div>
      )}
    </div>
  );
}
