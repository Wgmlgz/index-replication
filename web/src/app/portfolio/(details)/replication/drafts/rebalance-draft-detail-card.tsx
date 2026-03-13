'use client';

import { useTranslation } from 'react-i18next';

import type {
  PortfolioRebalanceItem,
  PortfolioRebalanceRun,
} from '@/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatDateTime(value: string | undefined, language: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat(language || 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatNumber(value: number | undefined, fractionDigits = 4): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function extractSummaryNumber(
  run: PortfolioRebalanceRun | undefined,
  key: string,
): number | null {
  const raw: unknown = run?.summary?.[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function unresolvedReason(item: PortfolioRebalanceItem): string {
  const reason: unknown = item.metadata?.reason;
  return typeof reason === 'string' && reason.trim().length > 0 ? reason : '-';
}

type RebalanceDraftDetailCardProps = {
  run: PortfolioRebalanceRun;
  items: PortfolioRebalanceItem[];
  language: string;
};

export function RebalanceDraftDetailCard({
  run,
  items,
  language,
}: RebalanceDraftDetailCardProps) {
  const { t } = useTranslation();

  return (
    <div className='grid gap-3'>
      <div className='grid gap-2'>
        <div className='grid gap-1 text-xs text-muted-foreground'>
          <p>
            {t('portfolio.replication.rebalances.detailModeLabel')}:{' '}
            {run.mode_key || '-'}
          </p>
          <p>
            {t('portfolio.replication.rebalances.detailExecutionLabel')}:{' '}
            {run.execution_mode || '-'}
          </p>
          <p>
            {t('portfolio.replication.rebalances.detailAsOfLabel')}:{' '}
            {run.as_of_date || '-'}
          </p>
          <p>
            {t('portfolio.replication.rebalances.detailCreatedLabel')}:{' '}
            {formatDateTime(run.created_at, language)}
          </p>
        </div>
      </div>

      {run.warnings && run.warnings.length > 0 ? (
        <Alert>
          <AlertTitle>
            {t('portfolio.replication.rebalances.warningsTitle')}
          </AlertTitle>
          <AlertDescription>{run.warnings.join(', ')}</AlertDescription>
        </Alert>
      ) : null}

      <div className='grid gap-1 text-xs text-muted-foreground'>
        <p>
          {t('portfolio.replication.rebalances.summaryItemsTotal')}:{' '}
          {formatNumber(
            extractSummaryNumber(run, 'items_total') ?? undefined,
            0,
          )}
        </p>
        <p>
          {t('portfolio.replication.rebalances.summaryActionable')}:{' '}
          {formatNumber(
            extractSummaryNumber(run, 'actionable_items') ?? undefined,
            0,
          )}
        </p>
        <p>
          {t('portfolio.replication.rebalances.summaryUnresolved')}:{' '}
          {formatNumber(
            extractSummaryNumber(run, 'unresolved_items') ?? undefined,
            0,
          )}
        </p>
        <p>
          {t('portfolio.replication.rebalances.summaryTurnover')}:{' '}
          {formatNumber(
            extractSummaryNumber(run, 'estimated_turnover_abs') ?? undefined,
            2,
          )}
        </p>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t('portfolio.replication.rebalances.itemsColumns.ticker')}
              </TableHead>
              <TableHead>
                {t('portfolio.replication.rebalances.itemsColumns.side')}
              </TableHead>
              <TableHead>
                {t('portfolio.replication.rebalances.itemsColumns.currentQty')}
              </TableHead>
              <TableHead>
                {t('portfolio.replication.rebalances.itemsColumns.targetQty')}
              </TableHead>
              <TableHead>
                {t('portfolio.replication.rebalances.itemsColumns.deltaQty')}
              </TableHead>
              <TableHead>
                {t(
                  'portfolio.replication.rebalances.itemsColumns.currentWeight',
                )}
              </TableHead>
              <TableHead>
                {t(
                  'portfolio.replication.rebalances.itemsColumns.targetWeight',
                )}
              </TableHead>
              <TableHead>
                {t('portfolio.replication.rebalances.itemsColumns.status')}
              </TableHead>
              <TableHead>
                {t('portfolio.replication.rebalances.itemsColumns.reason')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className='text-muted-foreground'>
                  {t('portfolio.replication.rebalances.emptyItems')}
                </TableCell>
              </TableRow>
            ) : null}
            {items.map(item => (
              <TableRow
                key={`${item.id ?? 0}-${item.ticker ?? ''}-${item.instrument_id ?? ''}`}
              >
                <TableCell>
                  {item.ticker || item.instrument_id || '-'}
                </TableCell>
                <TableCell>{item.side || '-'}</TableCell>
                <TableCell>{formatNumber(item.current_quantity)}</TableCell>
                <TableCell>{formatNumber(item.target_quantity)}</TableCell>
                <TableCell>{formatNumber(item.delta_quantity)}</TableCell>
                <TableCell>{formatNumber(item.current_weight)}</TableCell>
                <TableCell>{formatNumber(item.target_weight)}</TableCell>
                <TableCell>
                  <Badge variant='outline'>{item.status || '-'}</Badge>
                </TableCell>
                <TableCell>{unresolvedReason(item)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
