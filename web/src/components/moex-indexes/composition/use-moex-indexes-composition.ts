'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type MoexIndex as MoexIndex,
  type MoexIndexCompositionEntry as MoexIndexCompositionEntry,
  type MoexIndexTickerAnalyticsPoint as MoexIndexTickerAnalyticsPoint,
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
import { moexApi } from '@/lib/api';
import {
  resolveDateRange,
  resolveIntervalDays,
} from '@/lib/charting/time-series-controls';
import type {
  CompositionSelectionMode,
  CompositionTab,
  IntervalKey,
  RangeKey,
} from '../detail/moex-indexes-detail.types';

type CompositionState = {
  snapshotLoading: boolean;
  snapshotError: boolean;
  snapshotDate: string | null;
  snapshotItems: CompositionSnapshotItem[];
  seriesLoading: boolean;
  seriesError: boolean;
  series: CompositionSeries[];
};

export function useMoexIndexComposition(options: {
  selectedIndex: MoexIndex | null;
  rangeKey: RangeKey;
  intervalKey: IntervalKey;
  customFrom: string;
  customTill: string;
  latestTradeDate: string | null;
  compositionSelectionMode: CompositionSelectionMode;
  compositionSelectionDate: string;
  topCount: number;
  compositionTab: CompositionTab;
}): CompositionState {
  const dateRange = useMemo(
    () =>
      resolveDateRange(options.rangeKey, options.customFrom, options.customTill),
    [options.customFrom, options.customTill, options.rangeKey]
  );

  const effectiveSelectionDate = useMemo(() => {
    return (
      normalizeIsoDate(options.compositionSelectionDate) ??
      normalizeIsoDate(options.latestTradeDate) ??
      normalizeIsoDate(dateRange.till) ??
      undefined
    );
  }, [dateRange.till, options.compositionSelectionDate, options.latestTradeDate]);

  const intervalDays = useMemo(
    () => resolveIntervalDays(options.intervalKey),
    [options.intervalKey]
  );

  const snapshotQuery = useQuery({
    queryKey: [
      'moex-index-composition',
      options.selectedIndex?.secid,
      effectiveSelectionDate ?? 'latest',
    ],
    queryFn: async () => {
      const response = await moexApi.moexIndexesSecidCompositionGet(
        options.selectedIndex!.secid ?? '',
        effectiveSelectionDate
      );
      return response.data;
    },
    enabled: Boolean(options.selectedIndex?.secid && options.selectedIndex?.hasComposition),
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const snapshotItems = useMemo<CompositionSnapshotItem[]>(() => {
    const rows = snapshotQuery.data ?? [];
    return rows
      .map((row: MoexIndexCompositionEntry) => ({
        ticker: row.ticker ?? '',
        secId: row.secId ?? '',
        name: row.shortName || row.ticker || '',
        weight: row.weight ?? 0,
        tradeDate: row.tradeDate ?? '',
      }))
      .filter((row) => row.ticker.length > 0 && row.tradeDate.length > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [snapshotQuery.data]);

  const snapshotDateValue = snapshotItems[0]?.tradeDate ?? effectiveSelectionDate;

  const topCountParam = useMemo(
    () =>
      resolveCompositionTopCountParam(options.topCount, {
        treatMaxSafeIntegerAsAll: true,
      }),
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
      'moex-index-composition-series',
      options.selectedIndex?.secid,
      options.compositionSelectionMode,
      effectiveSelectionDate ?? '',
      fixedModeTickersParam,
      topCountParam,
      dateRange.from,
      dateRange.till,
      intervalDays ?? 'auto',
    ],
    queryFn: async () => {
      const response = await moexApi.moexIndexesSecidCompositionSeriesGet(
        options.selectedIndex!.secid ?? '',
        options.compositionSelectionMode === 'fixed' ? fixedModeTickersParam : '',
        topCountParam,
        options.compositionSelectionMode,
        options.compositionSelectionMode === 'fixed'
          ? effectiveSelectionDate
          : undefined,
        dateRange.from,
        dateRange.till,
        intervalDays,
        undefined,
      );
      return response.data;
    },
    enabled: Boolean(
      options.compositionTab !== 'snapshot' &&
        options.selectedIndex?.secid &&
        options.selectedIndex?.hasComposition &&
        (options.compositionSelectionMode === 'rolling' ||
          fixedModeTickers.length > 0) &&
        topCountParam >= 0
    ),
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
      getPoint: (point: MoexIndexTickerAnalyticsPoint) => {
        const time = point.tradeDate;
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
    snapshotDate: snapshotDateValue ?? null,
    snapshotItems,
    seriesLoading: seriesQuery.isLoading,
    seriesError: Boolean(seriesQuery.error),
    series,
  };
}
