'use client';

import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { moexClient, type MoexIndex } from '@/lib/moex-client';
import type { ChartPoint } from './index-chart';

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

type HistoryState = {
  historyLoading: boolean;
  historyError: boolean;
  chartData: ChartPoint[];
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
};

export function useMoexIndexHistory(
  selectedIndex: MoexIndex | null
): HistoryState {
  const dateRange = useMemo(() => {
    const today = new Date();
    return {
      from: formatDate(subDays(today, 365)),
      till: formatDate(today),
    };
  }, []);

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

  const normalizedHistory = useMemo(() => {
    return history
      .filter((point) => point.tradeDate && point.close !== null)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  }, [history]);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      normalizedHistory.map((point) => ({
        time: point.tradeDate,
        value: point.close as number,
      })),
    [normalizedHistory]
  );

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
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: selectedIndex?.decimals ?? 2,
    });
  }, [selectedIndex?.decimals]);

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
