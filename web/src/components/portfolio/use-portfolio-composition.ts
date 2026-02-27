'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  TBankPortfolioCompositionEntry,
  TBankPortfolioCompositionSeriesPoint,
} from '@/api-client';
import {
  buildCompositionSeries,
  normalizeIsoDate,
  resolveCompositionTopCountParam,
  resolveFixedModeTickers,
} from '@/components/charts/composition-analytics';
import type {
  CompositionSeries,
  CompositionSnapshotItem,
} from '@/components/charts/types';
import type {
  CompositionSelectionMode,
  CompositionTab,
} from '@/lib/charting/chart-controls-url-state';
import { tbankApi } from '@/lib/api';
import {
  resolveDateRange,
  resolveIntervalDays,
  type IntervalKey,
  type RangeKey,
} from '@/lib/charting/time-series-controls';

export type PortfolioCompositionTab = CompositionTab;
export type PortfolioCompositionSelectionMode = CompositionSelectionMode;

type PortfolioCompositionState = {
  snapshotLoading: boolean;
  snapshotError: boolean;
  snapshotDate: string | null;
  snapshotItems: CompositionSnapshotItem[];
  seriesLoading: boolean;
  seriesError: boolean;
  series: CompositionSeries[];
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

  const topCountParam = useMemo(
    () => resolveCompositionTopCountParam(options.topCount),
    [options.topCount]
  );

  const fixedModeTickers = useMemo(
    () =>
      resolveFixedModeTickers(
        options.compositionSelectionMode,
        topCountParam,
        snapshotItems
      ),
    [options.compositionSelectionMode, snapshotItems, topCountParam]
  );
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

  const series = useMemo<CompositionSeries[]>(() => {
    return buildCompositionSeries({
      rawSeries: seriesQuery.data,
      selectionMode: options.compositionSelectionMode,
      fixedModeTickers,
      snapshotItems,
      getPoint: (point: TBankPortfolioCompositionSeriesPoint) => {
        const time = point.trade_date;
        const value = point.weight;
        if (typeof time !== 'string' || time.length === 0) return null;
        if (typeof value !== 'number') return null;
        return { time, value };
      },
    });
  }, [
    fixedModeTickers,
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
