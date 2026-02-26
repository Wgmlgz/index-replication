'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type MoexIndex as MoexIndex,
  type MoexIndexCompositionEntry as MoexIndexCompositionEntry,
  type MoexIndexTickerAnalyticsPoint as MoexIndexTickerAnalyticsPoint,
} from '@/api-client';
import { moexApi } from '@/lib/api';
import { resolveDateRange, resolveIntervalDays } from '../detail/use-moex-indexes-detail.utils';
import type {
  CompositionSelectionMode,
  CompositionTab,
  IntervalKey,
  RangeKey,
} from '../detail/moex-indexes-detail.types';

export type CompositionSnapshotItem = {
  ticker: string;
  secId: string;
  name: string;
  weight: number;
  tradeDate: string;
};

export type CompositionSeries = {
  id: string;
  name: string;
  data: Array<{ time: string; value: number }>;
};

type CompositionState = {
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

  const topCountParam = useMemo(() => {
    if (!Number.isFinite(options.topCount)) return 10;
    if (options.topCount >= Number.MAX_SAFE_INTEGER) return 0;
    if (options.topCount < 0) return 0;
    return Math.floor(options.topCount);
  }, [options.topCount]);

  const fixedModeTickers = useMemo(() => {
    if (options.compositionSelectionMode !== 'fixed') return [] as string[];
    if (topCountParam === 0) {
      return snapshotItems.map((item) => item.ticker);
    }
    return snapshotItems.slice(0, topCountParam).map((item) => item.ticker);
  }, [options.compositionSelectionMode, snapshotItems, topCountParam]);
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

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    snapshotItems.forEach((item) => {
      map.set(item.ticker, item.name);
    });
    return map;
  }, [snapshotItems]);

  const series = useMemo<CompositionSeries[]>(() => {
    const seriesData = seriesQuery.data ?? {};
    const keys = new Set(Object.keys(seriesData));
    const baseOrder =
      options.compositionSelectionMode === 'fixed'
        ? fixedModeTickers
        : snapshotItems.map((item) => item.ticker);
    const orderedTickers = baseOrder.filter(
      (ticker): ticker is string => keys.has(ticker)
    );
    const leftovers = Object.keys(seriesData)
      .filter((ticker) => !orderedTickers.includes(ticker))
      .sort((a, b) => a.localeCompare(b));

    return [...orderedTickers, ...leftovers]
      .map((ticker) => {
        const points = (seriesData[ticker] ?? [])
          .map((point: MoexIndexTickerAnalyticsPoint) => {
            const time = point.tradeDate;
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
      .filter((item) => item.data.length > 0);
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
    snapshotDate: snapshotDateValue ?? null,
    snapshotItems,
    seriesLoading: seriesQuery.isLoading,
    seriesError: Boolean(seriesQuery.error),
    series,
  };
}
