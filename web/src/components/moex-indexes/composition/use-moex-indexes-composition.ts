'use client';

import { useMemo } from 'react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  moexClient,
  type MoexIndex,
  type MoexIndexCompositionEntry,
  type MoexIndexTickerAnalyticsPoint,
} from '@/lib/moex-client';
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
    () =>
      resolveIntervalDays(
        options.rangeKey,
        options.customFrom,
        options.customTill,
        options.intervalKey,
        300
      ),
    [
      options.customFrom,
      options.customTill,
      options.intervalKey,
      options.rangeKey,
    ]
  );

  const rangeDays = useMemo(() => {
    if (!dateRange.from || !dateRange.till) return null;
    const parsedFrom = parseISO(dateRange.from);
    const parsedTill = parseISO(dateRange.till);
    if (Number.isNaN(parsedFrom.valueOf()) || Number.isNaN(parsedTill.valueOf())) {
      return null;
    }
    return Math.abs(differenceInCalendarDays(parsedTill, parsedFrom));
  }, [dateRange.from, dateRange.till]);

  const pageSize = useMemo(() => {
    if (!rangeDays || rangeDays <= 0) return 1000;
    const estimate = Math.ceil(rangeDays / 2);
    return Math.min(1000, Math.max(200, estimate));
  }, [rangeDays]);

  const snapshotQuery = useQuery({
    queryKey: [
      'moex-index-composition',
      options.selectedIndex?.secid,
      snapshotDate,
    ],
    queryFn: () =>
      moexClient.getIndexComposition(options.selectedIndex!.secid, {
        date: snapshotDate ?? undefined,
        pageSize,
      }),
    enabled: Boolean(options.selectedIndex?.secid),
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

  const topTickers = useMemo(() => {
    return snapshotItems
      .slice(0, options.topCount)
      .map((item) => item.ticker)
      .filter((value) => value.length > 0);
  }, [options.topCount, snapshotItems]);

  const seriesQuery = useQuery({
    queryKey: [
      'moex-index-composition-series',
      options.selectedIndex?.secid,
      topTickers.join(','),
      dateRange.from,
      dateRange.till,
    ],
    queryFn: () =>
      moexClient.getIndexTickerAnalyticsSeries(
        options.selectedIndex!.secid,
        topTickers,
        {
          from: dateRange.from,
          till: dateRange.till,
          pageSize,
        }
      ),
    enabled: Boolean(
      options.compositionTab !== 'snapshot' &&
        options.selectedIndex?.secid &&
        topTickers.length > 0
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

  const resampleBuckets = useMemo(() => {
    if (!dateRange.from || !dateRange.till) return null;
    if (intervalDays <= 1) return null;
    const start = parseISO(dateRange.from);
    const end = parseISO(dateRange.till);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
      return null;
    }
    const buckets: Array<{ start: Date; end: Date; label: string }> = [];
    let bucketStart = start;
    while (bucketStart <= end) {
      const bucketEnd = addDays(bucketStart, intervalDays - 1);
      const endDate = bucketEnd > end ? end : bucketEnd;
      buckets.push({
        start: bucketStart,
        end: endDate,
        label: format(endDate, 'yyyy-MM-dd'),
      });
      bucketStart = addDays(bucketStart, intervalDays);
    }
    return buckets;
  }, [dateRange.from, dateRange.till, intervalDays]);

  const resampleSeries = (
    points: Array<{ time: string; value: number }>
  ) => {
    if (!resampleBuckets) return points;
    const result: Array<{ time: string; value: number }> = [];
    let index = 0;
    while (index < points.length && Number.isNaN(parseISO(points[index].time).valueOf())) {
      index += 1;
    }
    resampleBuckets.forEach((bucket) => {
      let value: number | null = null;
      while (index < points.length) {
        const parsed = parseISO(points[index].time);
        if (Number.isNaN(parsed.valueOf())) {
          index += 1;
          continue;
        }
        if (parsed < bucket.start) {
          index += 1;
          continue;
        }
        if (parsed <= bucket.end) {
          value = points[index].value;
          index += 1;
          continue;
        }
        break;
      }
      result.push({ time: bucket.label, value: value ?? 0 });
    });
    return result;
  };

  const series = useMemo<CompositionSeries[]>(() => {
    const seriesData = seriesQuery.data ?? {};
    return topTickers
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
          data: resampleSeries(points),
        };
      })
      .filter((item) => item.data.length > 0);
  }, [nameMap, resampleBuckets, seriesQuery.data, topTickers]);

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
