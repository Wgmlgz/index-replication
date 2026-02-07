'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { moexClient, type MoexIndex } from '@/lib/moex-client';
import type { ChartData } from './index-chart';
import { resolveDateRange } from './use-moex-indexes-detail.utils';
import type { ChartType, ChartViewMode, RangeKey } from './moex-indexes-detail.types';

type NormalizedHistoryPoint = {
  tradeDate: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
};

const DEFAULT_MAX_POINTS = 260;
const MAX_POINTS_BY_RANGE: Record<Exclude<RangeKey, 'custom'>, number> = {
  '1m': 60,
  '3m': 120,
  '6m': 180,
  ytd: 260,
  '1y': 260,
  '3y': 360,
  '5y': 520,
  max: 600,
};

const resolveMaxPoints = (
  rangeKey: RangeKey,
  from?: string,
  till?: string
) => {
  if (rangeKey !== 'custom') {
    return MAX_POINTS_BY_RANGE[rangeKey];
  }
  if (!from || !till) return DEFAULT_MAX_POINTS;
  const parsedFrom = parseISO(from);
  const parsedTill = parseISO(till);
  if (Number.isNaN(parsedFrom.valueOf()) || Number.isNaN(parsedTill.valueOf())) {
    return DEFAULT_MAX_POINTS;
  }
  const days = Math.abs(differenceInCalendarDays(parsedTill, parsedFrom));
  if (days <= 35) return 60;
  if (days <= 120) return 120;
  if (days <= 240) return 180;
  if (days <= 400) return 260;
  if (days <= 900) return 360;
  if (days <= 1500) return 520;
  return 600;
};

const downsampleHistory = (
  points: NormalizedHistoryPoint[],
  maxPoints: number
): NormalizedHistoryPoint[] => {
  if (points.length <= maxPoints) return points;
  const bucketSize = Math.ceil(points.length / maxPoints);
  const result: NormalizedHistoryPoint[] = [];

  for (let index = 0; index < points.length; index += bucketSize) {
    const bucket = points.slice(index, index + bucketSize);
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    if (!first || !last) continue;

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
  }

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

  const maxPoints = useMemo(
    () => resolveMaxPoints(options.rangeKey, dateRange.from, dateRange.till),
    [dateRange.from, dateRange.till, options.rangeKey]
  );

  const sampledHistory = useMemo(
    () => downsampleHistory(normalizedHistory, maxPoints),
    [maxPoints, normalizedHistory]
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
