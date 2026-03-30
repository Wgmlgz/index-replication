import type { TFunction } from 'i18next';
import type { ColumnDef } from '@tanstack/react-table';

import type {
  PortfolioRebalanceBenchmarkConstituent,
  PortfolioRebalanceHolding,
  PortfolioRebalanceInstrumentInfo,
  PortfolioRebalanceItem,
  PortfolioRebalanceMoney,
  PortfolioRebalanceTransaction,
} from '@/api-client';
import { TickerWithLogo } from '@/components/ticker/ticker-with-logo';
import { Badge } from '@/components/ui/badge';
import { SortHeader } from '@/app/portfolio/components/sortable-data-table';
import {
  formatDateTime,
  formatNumber,
  unresolvedReason,
} from './rebalance-draft-detail-helpers';

function renderTickerWithLogo(ticker?: string | null, fallback?: string | null) {
  const normalizedTicker = ticker?.trim();
  if (normalizedTicker) {
    return <TickerWithLogo ticker={normalizedTicker} textClassName='font-medium' />;
  }
  return fallback?.trim() || '-';
}

export function buildItemColumns(t: TFunction): ColumnDef<PortfolioRebalanceItem>[] {
  return [
    {
      accessorFn: row => row.ticker || row.instrument_id || '',
      id: 'ticker',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.ticker')}
        />
      ),
      cell: ({ row }) => renderTickerWithLogo(row.original.ticker, row.original.instrument_id),
    },
    {
      accessorFn: row => row.instrument_id || '',
      id: 'instrument_id',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.instrumentId')}
        />
      ),
      cell: ({ row }) => row.original.instrument_id || '-',
    },
    {
      accessorFn: row => row.side || '',
      id: 'side',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.side')}
        />
      ),
      cell: ({ row }) => row.original.side || '-',
    },
    {
      accessorFn: row => row.current_quantity ?? 0,
      id: 'current_quantity',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.currentQty')}
          alignRight
        />
      ),
      cell: ({ row }) => (
        <div className='text-right'>{formatNumber(row.original.current_quantity)}</div>
      ),
    },
    {
      accessorFn: row => row.target_quantity ?? 0,
      id: 'target_quantity',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.targetQty')}
          alignRight
        />
      ),
      cell: ({ row }) => (
        <div className='text-right'>{formatNumber(row.original.target_quantity)}</div>
      ),
    },
    {
      accessorFn: row => row.delta_quantity ?? 0,
      id: 'delta_quantity',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.deltaQty')}
          alignRight
        />
      ),
      cell: ({ row }) => (
        <div className='text-right'>{formatNumber(row.original.delta_quantity)}</div>
      ),
    },
    {
      accessorFn: row => row.current_weight ?? 0,
      id: 'current_weight',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.currentWeight')}
          alignRight
        />
      ),
      cell: ({ row }) => (
        <div className='text-right'>{formatNumber(row.original.current_weight)}</div>
      ),
    },
    {
      accessorFn: row => row.target_weight ?? 0,
      id: 'target_weight',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.targetWeight')}
          alignRight
        />
      ),
      cell: ({ row }) => (
        <div className='text-right'>{formatNumber(row.original.target_weight)}</div>
      ),
    },
    {
      accessorFn: row => row.ideal_weight ?? 0,
      id: 'ideal_weight',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.idealWeight')}
          alignRight
        />
      ),
      cell: ({ row }) => (
        <div className='text-right'>{formatNumber(row.original.ideal_weight)}</div>
      ),
    },
    {
      accessorFn: row => row.status || '',
      id: 'status',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.status')}
        />
      ),
      cell: ({ row }) => <Badge variant='outline'>{row.original.status || '-'}</Badge>,
    },
    {
      accessorFn: row => unresolvedReason(row),
      id: 'reason',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.reason')}
        />
      ),
      cell: ({ row }) => unresolvedReason(row.original),
    },
  ];
}

export function buildHoldingsColumns(
  t: TFunction,
): ColumnDef<PortfolioRebalanceHolding>[] {
  return [
    {
      accessorFn: row => row.ticker || '',
      id: 'ticker',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.ticker')}
        />
      ),
      cell: ({ row }) => renderTickerWithLogo(row.original.ticker),
    },
    {
      accessorFn: row => row.instrument_id || '',
      id: 'instrument_id',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.instrumentId')}
        />
      ),
      cell: ({ row }) => row.original.instrument_id || '-',
    },
    {
      accessorFn: row => row.current_quantity ?? 0,
      id: 'current_quantity',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.currentQty')}
          alignRight
        />
      ),
      cell: ({ row }) => (
        <div className='text-right'>{formatNumber(row.original.current_quantity)}</div>
      ),
    },
  ];
}

export function buildBenchmarkColumns(
  t: TFunction,
): ColumnDef<PortfolioRebalanceBenchmarkConstituent>[] {
  return [
    {
      accessorFn: row => row.ticker || '',
      id: 'ticker',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.ticker')}
        />
      ),
      cell: ({ row }) => renderTickerWithLogo(row.original.ticker),
    },
    {
      accessorFn: row => row.instrument_id || '',
      id: 'instrument_id',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.instrumentId')}
        />
      ),
      cell: ({ row }) => row.original.instrument_id || '-',
    },
    {
      accessorFn: row => row.target_weight ?? 0,
      id: 'target_weight',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.targetWeight')}
          alignRight
        />
      ),
      cell: ({ row }) => (
        <div className='text-right'>{formatNumber(row.original.target_weight)}</div>
      ),
    },
  ];
}

export function buildInstrumentsColumns(
  t: TFunction,
  language: string,
): ColumnDef<PortfolioRebalanceInstrumentInfo>[] {
  return [
    {
      accessorFn: row => row.ticker || '',
      id: 'ticker',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.ticker')}
        />
      ),
      cell: ({ row }) => renderTickerWithLogo(row.original.ticker),
    },
    {
      accessorFn: row => row.instrument_id || '',
      id: 'instrument_id',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.instrumentId')}
        />
      ),
      cell: ({ row }) => row.original.instrument_id || '-',
    },
    {
      accessorFn: row => row.price ?? 0,
      id: 'price',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.price')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.price, 6)}</div>,
    },
    {
      accessorFn: row => row.currency || '',
      id: 'currency',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.currency')}
        />
      ),
      cell: ({ row }) => row.original.currency || '-',
    },
    {
      accessorFn: row => row.lot_size ?? 0,
      id: 'lot_size',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.lotSize')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.lot_size, 0)}</div>,
    },
    {
      accessorFn: row => row.as_of_at || '',
      id: 'as_of_at',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.asOfAt')}
        />
      ),
      cell: ({ row }) => formatDateTime(row.original.as_of_at, language),
    },
    {
      accessorFn: row => row.source || '',
      id: 'source',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.source')}
        />
      ),
      cell: ({ row }) => row.original.source || '-',
    },
  ];
}

export function buildMoneyColumns(t: TFunction): ColumnDef<PortfolioRebalanceMoney>[] {
  return [
    {
      accessorFn: row => row.currency || '',
      id: 'currency',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.currency')}
        />
      ),
      cell: ({ row }) => row.original.currency || '-',
    },
    {
      accessorFn: row => row.available ?? 0,
      id: 'available',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.available')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.available, 2)}</div>,
    },
    {
      accessorFn: row => row.blocked ?? 0,
      id: 'blocked',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.blocked')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.blocked, 2)}</div>,
    },
  ];
}

export function buildTransactionsColumns(
  t: TFunction,
): ColumnDef<PortfolioRebalanceTransaction>[] {
  return [
    {
      accessorFn: row => row.sequence ?? 0,
      id: 'sequence',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.sequence')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.sequence, 0)}</div>,
    },
    {
      accessorFn: row => row.ticker || row.instrument_id || '',
      id: 'ticker',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.ticker')}
        />
      ),
      cell: ({ row }) => renderTickerWithLogo(row.original.ticker, row.original.instrument_id),
    },
    {
      accessorFn: row => row.instrument_id || '',
      id: 'instrument_id',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.instrumentId')}
        />
      ),
      cell: ({ row }) => row.original.instrument_id || '-',
    },
    {
      accessorFn: row => row.side || '',
      id: 'side',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.side')}
        />
      ),
      cell: ({ row }) => row.original.side || '-',
    },
    {
      accessorFn: row => row.quantity ?? 0,
      id: 'quantity',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.quantity')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.quantity)}</div>,
    },
    {
      accessorFn: row => row.price ?? 0,
      id: 'price',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.price')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.price, 6)}</div>,
    },
    {
      accessorFn: row => row.amount ?? 0,
      id: 'amount',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.amount')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.amount, 2)}</div>,
    },
    {
      accessorFn: row => row.currency || '',
      id: 'currency',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.currency')}
        />
      ),
      cell: ({ row }) => row.original.currency || '-',
    },
    {
      accessorFn: row => row.lot_size ?? 0,
      id: 'lot_size',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.rebalances.itemsColumns.lotSize')}
          alignRight
        />
      ),
      cell: ({ row }) => <div className='text-right'>{formatNumber(row.original.lot_size, 0)}</div>,
    },
  ];
}
