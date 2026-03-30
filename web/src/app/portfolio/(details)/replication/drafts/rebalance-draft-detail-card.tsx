'use client';

import { useTranslation } from 'react-i18next';

import type {
  PortfolioRebalanceDetailResponse,
  PortfolioRebalanceItem,
  PortfolioRebalanceMoney,
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

function unresolvedReason(item: PortfolioRebalanceItem): string {
  const reason: unknown = item.metadata?.reason;
  return typeof reason === 'string' && reason.trim().length > 0 ? reason : '-';
}

function renderMoneyRows(money: PortfolioRebalanceMoney[], digits = 2): string {
  if (money.length === 0) {
    return '-';
  }
  return money
    .map(
      row =>
        `${row.currency || '-'}: ${formatNumber(row.available, digits)} (blocked ${formatNumber(row.blocked, digits)})`,
    )
    .join('; ');
}

type RebalanceDraftDetailCardProps = {
  detail: PortfolioRebalanceDetailResponse;
  language: string;
};

export function RebalanceDraftDetailCard({
  detail,
  language,
}: RebalanceDraftDetailCardProps) {
  const { t } = useTranslation();

  const run = detail.run;
  const input = detail.input;
  const output = detail.output;
  const summary = detail.summary;

  const warnings = output?.warnings ?? [];
  const items = output?.items ?? [];
  const outputMoney = output?.money ?? [];
  const inputMoney = input?.money ?? [];

  return (
    <div className='grid gap-3'>
      <div className='grid gap-2'>
        <div className='grid gap-1 text-xs text-muted-foreground'>
          <p>
            {t('portfolio.replication.rebalances.detailModeLabel')}:{' '}
            {run?.mode_key || '-'}
          </p>
          <p>
            {t('portfolio.replication.rebalances.detailExecutionLabel')}:{' '}
            {run?.execution_mode || '-'}
          </p>
          <p>
            {t('portfolio.replication.rebalances.detailAsOfLabel')}:{' '}
            {run?.as_of_date || '-'}
          </p>
          <p>
            {t('portfolio.replication.rebalances.detailCreatedLabel')}:{' '}
            {formatDateTime(run?.created_at, language)}
          </p>
        </div>
      </div>

      {warnings.length > 0 ? (
        <Alert>
          <AlertTitle>
            {t('portfolio.replication.rebalances.warningsTitle')}
          </AlertTitle>
          <AlertDescription>{warnings.join(', ')}</AlertDescription>
        </Alert>
      ) : null}

      <div className='grid gap-1 text-xs text-muted-foreground'>
        <p className='font-medium text-foreground'>
          {t('portfolio.replication.rebalances.inputTitle')}
        </p>
        <p>
          {t('portfolio.replication.rebalances.inputInvestableCapital')}:{' '}
          {formatNumber(input?.investable_capital, 2)}
        </p>
        <p>
          {t('portfolio.replication.rebalances.inputHoldingsCount')}:{' '}
          {formatNumber(input?.holdings?.length, 0)}
        </p>
        <p>
          {t('portfolio.replication.rebalances.inputBenchmarkCount')}:{' '}
          {formatNumber(input?.benchmark?.length, 0)}
        </p>
        <p>
          {t('portfolio.replication.rebalances.inputInstrumentsCount')}:{' '}
          {formatNumber(input?.instruments?.length, 0)}
        </p>
        <p>
          {t('portfolio.replication.rebalances.inputMoneyLabel')}:{' '}
          {renderMoneyRows(inputMoney)}
        </p>
      </div>

      <div className='grid gap-1 text-xs text-muted-foreground'>
        <p className='font-medium text-foreground'>
          {t('portfolio.replication.rebalances.outputTitle')}
        </p>
        <p>
          {t('portfolio.replication.rebalances.outputMoneyLabel')}:{' '}
          {renderMoneyRows(outputMoney)}
        </p>
      </div>

      <div className='grid gap-1 text-xs text-muted-foreground'>
        <p className='font-medium text-foreground'>
          {t('portfolio.replication.rebalances.summaryTitle')}
        </p>
        <p>
          {t('portfolio.replication.rebalances.summaryItemsTotal')}:{' '}
          {formatNumber(summary?.items_total, 0)}
        </p>
        <p>
          {t('portfolio.replication.rebalances.summaryActionable')}:{' '}
          {formatNumber(summary?.actionable_items, 0)}
        </p>
        <p>
          {t('portfolio.replication.rebalances.summaryUnresolved')}:{' '}
          {formatNumber(summary?.unresolved_items, 0)}
        </p>
        <p>
          {t('portfolio.replication.rebalances.summaryTurnover')}:{' '}
          {formatNumber(summary?.estimated_turnover_abs, 2)}
        </p>
      </div>

      <div className='max-h-[50svh] overflow-y-auto rounded-md border'>
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
            {items.map((item, index) => (
              <TableRow
                key={`${index}-${item.ticker ?? ''}-${item.instrument_id ?? ''}`}
              >
                <TableCell>{item.ticker || item.instrument_id || '-'}</TableCell>
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
