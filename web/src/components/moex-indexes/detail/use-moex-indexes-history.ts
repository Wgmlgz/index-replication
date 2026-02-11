'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
    () => resolveIntervalDays(options.intervalKey),
    [options.intervalKey]
  );

  const historyQuery = useQuery({
    queryKey: [
      'moex-index-history',
      selectedIndex?.secid,
      dateRange.from,
      dateRange.till,
      intervalDays ?? 'auto',
    ],
    queryFn: () =>
      moexClient.getIndexHistory(selectedIndex!.secid, {
        from: dateRange.from,
        till: dateRange.till,
        intervalDays,
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

  const chartData = useMemo<ChartData>(() => {
    const baseValue = normalizedHistory[0]?.close ?? null;
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
      return normalizedHistory
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

    return normalizedHistory
      .map((point) => {
        const value = normalizeValue(point.close);
        if (value === null) return null;
        return { time: point.tradeDate, value };
      })
      .filter(
        (point): point is { time: string; value: number } => Boolean(point)
      );
  }, [normalizedHistory, options.chartType, options.viewMode]);

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
