'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { moexClient, type MoexIndex } from '@/lib/moex-client';
import type { ChartData } from './index-chart';
import { resolveDateRange, resolveIntervalDays } from './use-moex-indexes-detail.utils';
import type { ChartType, ChartViewMode, IntervalKey, RangeKey } from './moex-indexes-detail.types';

type NormalizedHistoryPoint = {
  tradeDate: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
};

const TARGET_POINTS = 300;
const MAX_PAGE_SIZE = 1000;
const MIN_PAGE_SIZE = 200;

const resolveRangeDays = (from?: string, till?: string) => {
  if (!from || !till) return null;
  const parsedFrom = parseISO(from);
  const parsedTill = parseISO(till);
  if (Number.isNaN(parsedFrom.valueOf()) || Number.isNaN(parsedTill.valueOf())) {
    return null;
  }
  return Math.abs(differenceInCalendarDays(parsedTill, parsedFrom));
};

const resolvePageSize = (rangeDays: number | null) => {
  if (!rangeDays || rangeDays <= 0) return MAX_PAGE_SIZE;
  const estimated = Math.ceil(rangeDays / 2);
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, estimated));
};

const downsampleHistoryByInterval = (
  points: NormalizedHistoryPoint[],
  intervalDays: number
): NormalizedHistoryPoint[] => {
  if (intervalDays <= 1) return points;
  const result: NormalizedHistoryPoint[] = [];
  let bucketStart: Date | null = null;
  let bucket: NormalizedHistoryPoint[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    if (!first || !last) return;

    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    bucket.forEach((point) => {
      const highValue = point.high ?? point.close;
      const lowValue = point.low ?? point.close;
      if (highValue > high) high = highValue;
      if (lowValue < low) low = lowValue;
    });

    if (!Number.isFinite(high) || !Number.isFinite(low)) {
      high = last.close;
      low = last.close;
    }

    result.push({
      tradeDate: last.tradeDate,
      open: first.open ?? first.close,
      high,
      low,
      close: last.close,
    });
  };

  points.forEach((point) => {
    const parsed = parseISO(point.tradeDate);
    if (Number.isNaN(parsed.valueOf())) return;
    if (!bucketStart) {
      bucketStart = parsed;
      bucket = [point];
      return;
    }
    const diff = Math.abs(differenceInCalendarDays(parsed, bucketStart));
    if (diff < intervalDays) {
      bucket.push(point);
      return;
    }
    flush();
    bucketStart = parsed;
    bucket = [point];
  });
  flush();

  return result;
};

type HistoryState = {
  historyLoading: boolean;
  historyError: boolean;
  chartData: ChartData;
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
};

export function useMoexIndexHistory(
  selectedIndex: MoexIndex | null,
  options: {
    rangeKey: RangeKey;
    intervalKey: IntervalKey;
    customFrom: string;
    customTill: string;
    viewMode: ChartViewMode;
    chartType: ChartType;
  }
): HistoryState {
  const { i18n } = useTranslation();
  const dateRange = useMemo(() => {
    return resolveDateRange(
      options.rangeKey,
      options.customFrom,
      options.customTill
    );
  }, [options.customFrom, options.customTill, options.rangeKey]);

  const intervalDays = useMemo(
    () =>
      resolveIntervalDays(
        options.rangeKey,
        options.customFrom,
        options.customTill,
        options.intervalKey,
        TARGET_POINTS
      ),
    [
      options.customFrom,
      options.customTill,
      options.intervalKey,
      options.rangeKey,
    ]
  );

  const rangeDays = useMemo(
    () => resolveRangeDays(dateRange.from, dateRange.till),
    [dateRange.from, dateRange.till]
  );

  const pageSize = useMemo(() => resolvePageSize(rangeDays), [rangeDays]);

  const historyQuery = useQuery({
    queryKey: [
      'moex-index-history',
      selectedIndex?.secid,
      dateRange.from,
      dateRange.till,
    ],
    queryFn: () =>
      moexClient.getIndexHistory(selectedIndex!.secid, {
        from: dateRange.from,
        till: dateRange.till,
        pageSize,
      }),
    enabled: Boolean(selectedIndex?.secid),
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const history = historyQuery.data ?? [];
  const historyLoading = historyQuery.isLoading;
  const historyError = Boolean(historyQuery.error);

  const normalizedHistory = useMemo<NormalizedHistoryPoint[]>(() => {
    return history
      .filter((point) => point.tradeDate && point.close !== null)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
      .map((point) => ({
        tradeDate: point.tradeDate,
        close: point.close as number,
        open: point.open,
        high: point.high,
        low: point.low,
      }));
  }, [history]);

  const sampledHistory = useMemo(
    () => downsampleHistoryByInterval(normalizedHistory, intervalDays),
    [intervalDays, normalizedHistory]
  );

  const chartData = useMemo<ChartData>(() => {
    const baseValue = sampledHistory[0]?.close ?? null;
    const usePercent =
      options.viewMode === 'percent' &&
      baseValue !== null &&
      baseValue !== 0;

    const normalizeValue = (value: number | null) => {
      if (value === null) return null;
      if (!usePercent) return value;
      return ((value - baseValue) / baseValue) * 100;
    };

    if (options.chartType === 'candlestick') {
      return sampledHistory
        .map((point) => {
          const open = normalizeValue(point.open);
          const high = normalizeValue(point.high);
          const low = normalizeValue(point.low);
          const close = normalizeValue(point.close);
          if (
            open === null ||
            high === null ||
            low === null ||
            close === null
          ) {
            return null;
          }
          return {
            time: point.tradeDate,
            open,
            high,
            low,
            close,
          };
        })
        .filter(
          (
            point
          ): point is {
            time: string;
            open: number;
            high: number;
            low: number;
            close: number;
          } => Boolean(point)
        );
    }

    return sampledHistory
      .map((point) => {
        const value = normalizeValue(point.close);
        if (value === null) return null;
        return { time: point.tradeDate, value };
      })
      .filter(
        (point): point is { time: string; value: number } => Boolean(point)
      );
  }, [options.chartType, options.viewMode, sampledHistory]);

  const latestPoint = normalizedHistory[normalizedHistory.length - 1];
  const previousPoint = normalizedHistory[normalizedHistory.length - 2];
  const latestValue = latestPoint?.close ?? null;
  const previousValue = previousPoint?.close ?? null;
  const change =
    latestValue !== null && previousValue !== null
      ? latestValue - previousValue
      : null;
  const changePercent =
    change !== null && previousValue ? (change / previousValue) * 100 : null;

  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat(i18n.language || 'en', {
      maximumFractionDigits: selectedIndex?.decimals ?? 2,
    });
  }, [i18n.language, selectedIndex?.decimals]);

  return {
    historyLoading,
    historyError,
    chartData,
    latestValue,
    change,
    changePercent,
    numberFormatter,
  };
}
