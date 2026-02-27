'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TBankPortfolioHistoryPoint } from '@/api-client';
import type { ChartData } from '@/components/charts/index-chart';
import {
  buildLineChartData,
  calculateChangeStats,
} from '@/components/charts/time-series-analytics';
import { tbankApi } from '@/lib/api';
import {
  resolveDateRange,
  resolveIntervalDays,
  type ChartViewMode,
  type IntervalKey,
  type RangeKey,
} from '@/lib/charting/time-series-controls';

type PortfolioHistoryState = {
  loading: boolean;
  error: boolean;
  chartData: ChartData;
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  numberFormatter: Intl.NumberFormat;
};

const hasTradeDate = (
  point: TBankPortfolioHistoryPoint
): point is TBankPortfolioHistoryPoint & { trade_date: string } =>
  typeof point.trade_date === 'string' && point.trade_date.length > 0;

export function usePortfolioHistory(options: {
  accountID: string;
  rangeKey: RangeKey;
  intervalKey: IntervalKey;
  customFrom: string;
  customTill: string;
  viewMode: ChartViewMode;
}): PortfolioHistoryState {
  const dateRange = useMemo(
    () => resolveDateRange(options.rangeKey, options.customFrom, options.customTill),
    [options.customFrom, options.customTill, options.rangeKey]
  );
  const intervalDays = useMemo(
    () => resolveIntervalDays(options.intervalKey),
    [options.intervalKey]
  );

  const historyQuery = useQuery({
    queryKey: [
      'tbank-portfolio-history',
      options.accountID || '__default__',
      dateRange.from,
      dateRange.till,
      intervalDays ?? 'auto',
    ],
    queryFn: async () => {
      const response = await tbankApi.meTbankPortfolioHistoryGet(
        options.accountID || undefined,
        dateRange.from,
        dateRange.till,
        intervalDays
      );
      return response.data ?? [];
    },
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const normalizedHistory = useMemo(() => {
    return history
      .filter(hasTradeDate)
      .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
      .map(point => ({
        tradeDate: point.trade_date,
        value: point.total_amount_portfolio ?? 0,
        currency: point.total_amount_portfolio_currency ?? '',
      }));
  }, [history]);

  const valuePoints = useMemo(
    () =>
      normalizedHistory.map(point => ({
        time: point.tradeDate,
        value: point.value,
      })),
    [normalizedHistory]
  );
  const { latestValue, change, changePercent } = useMemo(
    () => calculateChangeStats(valuePoints.map(point => point.value)),
    [valuePoints]
  );

  const chartData = useMemo<ChartData>(() => {
    return buildLineChartData(valuePoints, options.viewMode);
  }, [options.viewMode, valuePoints]);

  const currency =
    normalizedHistory[normalizedHistory.length - 1]?.currency ?? '';
  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }),
    []
  );

  return {
    loading: historyQuery.isLoading,
    error: Boolean(historyQuery.error),
    chartData,
    latestValue,
    change,
    changePercent,
    currency,
    numberFormatter,
  };
}
