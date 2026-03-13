'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { MoexIndex } from '@/api-client';
import type { PriceChartData } from '@/components/charts-new/visualization/chart-types';
import type { ProviderPriceHistoryPoint } from '@/components/charts-new/data/domain/models';
import {
  resolveDateRange,
  resolveIntervalDays,
} from '@/lib/charting/time-series-controls';
import type { PriceDataControls } from '@/components/charts-new/types/controls';
import type { PriceVisualizationDataState } from './chart-query.types';
import {
  calculateChangeStats,
  createViewModeNormalizer,
} from './data-analytics';
import type { ChartsDataProvider } from './providers';

type NormalizedHistoryPoint = {
  tradeDate: string;
  close: number;
  open: number | null;
  high: number | null;
  low: number | null;
  currency: string;
};

const hasTradeDateAndClose = (
  point: ProviderPriceHistoryPoint
): point is ProviderPriceHistoryPoint & { tradeDate: string; close: number } => {
  return typeof point.tradeDate === 'string' && typeof point.close === 'number';
};

export function usePriceVisualizationData(
  selectedIndex: MoexIndex | null,
  controls: PriceDataControls,
  provider: ChartsDataProvider
): PriceVisualizationDataState {
  const { i18n } = useTranslation();
  const dateRange = useMemo(
    () =>
      resolveDateRange(
        controls.rangeKey,
        controls.customFrom,
        controls.customTill
      ),
    [controls.customFrom, controls.customTill, controls.rangeKey]
  );

  const intervalDays = useMemo(
    () => resolveIntervalDays(controls.intervalKey),
    [controls.intervalKey]
  );
  const cache = provider.cache;

  const historyQuery = useQuery({
    queryKey: [
      provider.id,
      'moex-index-history',
      selectedIndex?.secid,
      dateRange.from,
      dateRange.till,
      intervalDays ?? 'auto',
    ],
    queryFn: async () => {
      return provider.getPriceHistory({
        secid: selectedIndex!.secid ?? '',
        from: dateRange.from,
        till: dateRange.till,
        intervalDays,
      });
    },
    enabled: Boolean(selectedIndex?.secid),
    refetchOnWindowFocus: false,
    staleTime: cache.staleTime,
    gcTime: cache.gcTime,
    refetchOnMount: cache.refetchOnMount,
    meta: {
      persist: cache.persist,
    },
    retry: 1,
  });

  const history = useMemo<ProviderPriceHistoryPoint[]>(
    () => historyQuery.data ?? [],
    [historyQuery.data]
  );
  const normalizedHistory = useMemo<NormalizedHistoryPoint[]>(() => {
    return history
      .filter(hasTradeDateAndClose)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
      .map(point => ({
        tradeDate: point.tradeDate,
        close: point.close,
        open: point.open ?? null,
        high: point.high ?? null,
        low: point.low ?? null,
        currency: point.currency ?? '',
      }));
  }, [history]);

  const closeValues = useMemo(
    () => normalizedHistory.map(point => point.close),
    [normalizedHistory]
  );
  const { latestValue, change, changePercent } = useMemo(
    () => calculateChangeStats(closeValues),
    [closeValues]
  );

  const chartData = useMemo<PriceChartData>(() => {
    const baseValue = normalizedHistory[0]?.close ?? null;
    const normalizeValue = createViewModeNormalizer(baseValue, controls.viewMode);

    if (controls.chartType === 'candlestick') {
      return normalizedHistory
        .map(point => {
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
      .map(point => {
        const value = normalizeValue(point.close);
        if (value === null) return null;
        return { time: point.tradeDate, value };
      })
      .filter(
        (point): point is { time: string; value: number } => Boolean(point)
      );
  }, [controls.chartType, controls.viewMode, normalizedHistory]);

  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat(i18n.language || 'en', {
      maximumFractionDigits: selectedIndex?.decimals ?? 2,
    });
  }, [i18n.language, selectedIndex?.decimals]);
  const currency = normalizedHistory[normalizedHistory.length - 1]?.currency ?? '';

  return {
    loading: historyQuery.isLoading,
    error: Boolean(historyQuery.error),
    data: chartData,
    dateRange,
    latestValue,
    change,
    changePercent,
    numberFormatter,
    currency,
  };
}
