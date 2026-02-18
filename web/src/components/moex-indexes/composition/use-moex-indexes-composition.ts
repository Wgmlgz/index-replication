'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type ModelsMoexIndex as MoexIndex,
  type ModelsMoexIndexCompositionEntry as MoexIndexCompositionEntry,
  type ModelsMoexIndexTickerAnalyticsPoint as MoexIndexTickerAnalyticsPoint,
} from '@/api-client';
import { moexApi } from '@/lib/api';
import { resolveDateRange, resolveIntervalDays } from '../detail/use-moex-indexes-detail.utils';
import type { CompositionTab, IntervalKey, RangeKey } from '../detail/moex-indexes-detail.types';

export type CompositionSnapshotItem = {
  ticker: string;
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

export function useMoexIndexComposition(options: {
  selectedIndex: MoexIndex | null;
  rangeKey: RangeKey;
  intervalKey: IntervalKey;
  customFrom: string;
  customTill: string;
  latestTradeDate: string | null;
  topCount: number;
  compositionTab: CompositionTab;
}): CompositionState {
  const dateRange = useMemo(
    () =>
      resolveDateRange(options.rangeKey, options.customFrom, options.customTill),
    [options.customFrom, options.customTill, options.rangeKey]
  );

  const snapshotDate = options.latestTradeDate ?? dateRange.till ?? null;

  const intervalDays = useMemo(
    () => resolveIntervalDays(options.intervalKey),
    [options.intervalKey]
  );

  const snapshotQuery = useQuery({
    queryKey: [
      'moex-index-composition',
      options.selectedIndex?.secid,
      snapshotDate,
    ],
    queryFn: async () => {
      const response = await moexApi.moexIndexesSecidCompositionGet(
        options.selectedIndex!.secid ?? '',
        snapshotDate ?? undefined
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
        ticker: row.ticker,
        name: row.shortName || row.ticker,
        weight: row.weight ?? 0,
        tradeDate: row.tradeDate,
      }))
      .filter((row) => row.ticker.length > 0 && row.tradeDate.length > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [snapshotQuery.data]);

  const snapshotDateValue = snapshotItems[0]?.tradeDate ?? snapshotDate;

  const topCountParam = useMemo(() => {
    if (!Number.isFinite(options.topCount)) return 10;
    if (options.topCount >= Number.MAX_SAFE_INTEGER) return 0;
    if (options.topCount < 0) return 0;
    return Math.floor(options.topCount);
  }, [options.topCount]);

  const seriesQuery = useQuery({
    queryKey: [
      'moex-index-composition-series',
      options.selectedIndex?.secid,
      topCountParam,
      dateRange.from,
      dateRange.till,
      intervalDays ?? 'auto',
    ],
    queryFn: async () => {
      const response = await moexApi.moexIndexesSecidCompositionSeriesGet(
        options.selectedIndex!.secid ?? '',
        '',
        dateRange.from,
        dateRange.till,
        intervalDays,
        undefined,
        {
          params: { topCount: topCountParam },
        }
      );
      return response.data;
    },
    enabled: Boolean(
      options.compositionTab !== 'snapshot' &&
        options.selectedIndex?.secid &&
        options.selectedIndex?.hasComposition &&
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
    const orderedTickers = snapshotItems
      .map((item) => item.ticker)
      .filter((ticker): ticker is string => keys.has(ticker));
    const leftovers = Object.keys(seriesData)
      .filter((ticker) => !orderedTickers.includes(ticker))
      .sort((a, b) => a.localeCompare(b));

    return [...orderedTickers, ...leftovers]
      .map((ticker) => {
        const points = (seriesData[ticker] ?? [])
          .filter(
            (point: MoexIndexTickerAnalyticsPoint) =>
              point.tradeDate && point.weight !== null
          )
          .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
          .map((point) => ({
            time: point.tradeDate,
            value: point.weight as number,
          }));
        return {
          id: ticker,
          name: nameMap.get(ticker) ?? ticker,
          data: points,
        };
      })
      .filter((item) => item.data.length > 0);
  }, [nameMap, seriesQuery.data, snapshotItems]);

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
