'use client';

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  const formatStatus = (status: CompositionCompareRow['status']): string =>
    t(`portfolio.composition.compare.status.${status}`);

  return (
    <div className='flex min-h-[200px] min-w-0 flex-1 flex-col gap-3 overflow-hidden'>
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
                <TableRow>
                  <TableHead>{t('portfolio.composition.compare.columns.ticker')}</TableHead>
                  <TableHead>{t('portfolio.composition.compare.columns.name')}</TableHead>
                  <TableHead className='text-right'>
                    {t('portfolio.composition.compare.columns.portfolioWeight')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('portfolio.composition.compare.columns.benchmarkWeight')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('portfolio.composition.compare.columns.activeWeight')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('portfolio.composition.compare.columns.absActive')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('portfolio.composition.compare.columns.errorContribution')}
                  </TableHead>
                  <TableHead>{t('portfolio.composition.compare.columns.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.key}>
                    <TableCell className='font-medium'>{row.ticker}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className='text-right'>
                      {formatPercent(row.portfolioWeight)}
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatPercent(row.benchmarkWeight)}
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatPercent(row.activeWeight)}
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatPercent(row.absActive)}
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatPercent(row.contributionPct)}
                    </TableCell>
                    <TableCell>{formatStatus(row.status)}</TableCell>
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
