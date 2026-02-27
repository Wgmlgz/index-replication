'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  TBankPortfolioCompositionEntry,
  TBankPortfolioCompositionSeriesPoint,
} from '@/api-client';
import type { CompositionSnapshotItem } from '@/components/charts/composition-snapshot-chart';
import type { CompositionSeries } from '@/components/charts/composition-series-chart';
import { tbankApi } from '@/lib/api';
import {
  resolveDateRange,
  resolveIntervalDays,
  type IntervalKey,
  type RangeKey,
} from '@/lib/charting/time-series-controls';

export type PortfolioCompositionTab = 'snapshot' | 'trend' | 'stacked';
export type PortfolioCompositionSelectionMode = 'fixed' | 'rolling';

type PortfolioCompositionState = {
  snapshotLoading: boolean;
  snapshotError: boolean;
  snapshotDate: string | null;
  snapshotItems: CompositionSnapshotItem[];
  seriesLoading: boolean;
  seriesError: boolean;
  series: CompositionSeries[];
};

const normalizeIsoDate = (value: string | null | undefined): string | undefined => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  return normalized;
};

export function usePortfolioComposition(options: {
  accountID: string;
  rangeKey: RangeKey;
  intervalKey: IntervalKey;
  customFrom: string;
  customTill: string;
  compositionSelectionMode: PortfolioCompositionSelectionMode;
  compositionSelectionDate: string;
  topCount: number;
  compositionTab: PortfolioCompositionTab;
}): PortfolioCompositionState {
  const dateRange = useMemo(
    () => resolveDateRange(options.rangeKey, options.customFrom, options.customTill),
    [options.customFrom, options.customTill, options.rangeKey]
  );
  const intervalDays = useMemo(
    () => resolveIntervalDays(options.intervalKey),
    [options.intervalKey]
  );

  const effectiveSelectionDate = useMemo(() => {
    return (
      normalizeIsoDate(options.compositionSelectionDate) ??
      normalizeIsoDate(dateRange.till) ??
      undefined
    );
  }, [dateRange.till, options.compositionSelectionDate]);

  const snapshotQuery = useQuery({
    queryKey: [
      'tbank-portfolio-composition',
      options.accountID || '__default__',
      effectiveSelectionDate ?? 'latest',
    ],
    queryFn: async () => {
      const response = await tbankApi.meTbankPortfolioCompositionGet(
        options.accountID || undefined,
        options.compositionSelectionMode === 'fixed'
          ? effectiveSelectionDate
          : undefined
      );
      return response.data ?? [];
    },
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const snapshotItems = useMemo<CompositionSnapshotItem[]>(() => {
    const rows = snapshotQuery.data ?? [];
    return rows
      .map((row: TBankPortfolioCompositionEntry) => ({
        ticker: row.ticker ?? row.instrument_id ?? '',
        secId: row.instrument_id ?? '',
        name: row.name || row.ticker || row.instrument_id || '',
        weight: row.weight ?? 0,
        tradeDate: row.trade_date ?? '',
      }))
      .filter(row => row.ticker.length > 0 && row.tradeDate.length > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [snapshotQuery.data]);

  const topCountParam = useMemo(() => {
    if (!Number.isFinite(options.topCount)) return 10;
    if (options.topCount < 0) return 0;
    return Math.floor(options.topCount);
  }, [options.topCount]);

  const fixedModeTickers = useMemo(() => {
    if (options.compositionSelectionMode !== 'fixed') return [] as string[];
    if (topCountParam === 0) return snapshotItems.map(item => item.ticker);
    return snapshotItems.slice(0, topCountParam).map(item => item.ticker);
  }, [options.compositionSelectionMode, snapshotItems, topCountParam]);
  const fixedModeTickersParam = useMemo(
    () => fixedModeTickers.join(','),
    [fixedModeTickers]
  );

  const seriesQuery = useQuery({
    queryKey: [
      'tbank-portfolio-composition-series',
      options.accountID || '__default__',
      options.compositionSelectionMode,
      effectiveSelectionDate ?? '',
      fixedModeTickersParam,
      topCountParam,
      dateRange.from,
      dateRange.till,
      intervalDays ?? 'auto',
    ],
    queryFn: async () => {
      const response = await tbankApi.meTbankPortfolioCompositionSeriesGet(
        options.accountID || undefined,
        options.compositionSelectionMode === 'fixed' ? fixedModeTickersParam : '',
        topCountParam,
        options.compositionSelectionMode,
        options.compositionSelectionMode === 'fixed'
          ? effectiveSelectionDate
          : undefined,
        dateRange.from,
        dateRange.till,
        intervalDays
      );
      return response.data ?? {};
    },
    enabled:
      options.compositionTab !== 'snapshot' &&
      (options.compositionSelectionMode === 'rolling' ||
        fixedModeTickers.length > 0),
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    snapshotItems.forEach(item => {
      map.set(item.ticker, item.name);
    });
    return map;
  }, [snapshotItems]);

  const series = useMemo<CompositionSeries[]>(() => {
    const data = seriesQuery.data ?? {};
    const keys = new Set(Object.keys(data));
    const baseOrder =
      options.compositionSelectionMode === 'fixed'
        ? fixedModeTickers
        : snapshotItems.map(item => item.ticker);
    const orderedTickers = baseOrder.filter(ticker => keys.has(ticker));
    const leftovers = Object.keys(data)
      .filter(ticker => !orderedTickers.includes(ticker))
      .sort((a, b) => a.localeCompare(b));

    return [...orderedTickers, ...leftovers]
      .map(ticker => {
        const points = (data[ticker] ?? [])
          .map((point: TBankPortfolioCompositionSeriesPoint) => {
            const time = point.trade_date;
            const value = point.weight;
            if (typeof time !== 'string' || time.length === 0) return null;
            if (typeof value !== 'number') return null;
            return { time, value };
          })
          .filter(
            (point): point is { time: string; value: number } => point !== null
          )
          .sort((a, b) => a.time.localeCompare(b.time));
        return {
          id: ticker,
          name: nameMap.get(ticker) ?? ticker,
          data: points,
        };
      })
      .filter(item => item.data.length > 0);
  }, [
    fixedModeTickers,
    nameMap,
    options.compositionSelectionMode,
    seriesQuery.data,
    snapshotItems,
  ]);

  return {
    snapshotLoading: snapshotQuery.isLoading,
    snapshotError: Boolean(snapshotQuery.error),
    snapshotDate:
      snapshotItems[0]?.tradeDate ??
      effectiveSelectionDate ??
      null,
    snapshotItems,
    seriesLoading: seriesQuery.isLoading,
    seriesError: Boolean(seriesQuery.error),
    series,
  };
}
