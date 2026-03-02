'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MoexIndex } from '@/api-client';
import type { ProviderCompositionSeriesPoint } from '@/components/charts-new/data/domain/models';
import type { CompositionSnapshotItem } from '@/components/charts-new/visualization/chart-types';
import type { CompositionDataControls } from '@/components/charts-new/types/controls';
import type { CompositionSeriesDataState } from './chart-query.types';
import {
  buildCompositionSeries,
  resolveCompositionTopCountParam,
  resolveFixedModeTickers,
} from './data-analytics';
import type { ChartsDataProvider } from './providers';

type CompositionSeriesControls = Pick<
  CompositionDataControls,
  'compositionSelectionMode' | 'compositionTab' | 'topCount'
>;

export function useCompositionSeriesData(options: {
  selectedIndex: MoexIndex | null;
  snapshotItems: CompositionSnapshotItem[];
  effectiveSelectionDate?: string;
  dateRange: {
    from?: string;
    till?: string;
  };
  intervalDays?: number;
  controls: CompositionSeriesControls;
  provider: ChartsDataProvider;
}): CompositionSeriesDataState {
  const {
    selectedIndex,
    snapshotItems,
    effectiveSelectionDate,
    dateRange,
    intervalDays,
    controls,
    provider,
  } = options;

  const topCountValue =
    controls.topCount === null ? Number.MAX_SAFE_INTEGER : controls.topCount;

  const topCountParam = useMemo(
    () =>
      resolveCompositionTopCountParam(topCountValue, {
        treatMaxSafeIntegerAsAll: true,
      }),
    [topCountValue]
  );

  const fixedModeTickers = useMemo(
    () =>
      resolveFixedModeTickers(
        controls.compositionSelectionMode,
        topCountParam,
        snapshotItems
      ),
    [controls.compositionSelectionMode, snapshotItems, topCountParam]
  );
  const fixedModeTickersParam = useMemo(
    () => fixedModeTickers.join(','),
    [fixedModeTickers]
  );

  const seriesQuery = useQuery({
    queryKey: [
      provider.id,
      'moex-index-composition-series',
      selectedIndex?.secid,
      controls.compositionSelectionMode,
      effectiveSelectionDate ?? '',
      fixedModeTickersParam,
      topCountParam,
      dateRange.from,
      dateRange.till,
      intervalDays ?? 'auto',
    ],
    queryFn: async () => {
      return provider.getCompositionSeries({
        secid: selectedIndex!.secid ?? '',
        tickers:
          controls.compositionSelectionMode === 'fixed'
            ? fixedModeTickersParam
            : '',
        topCount: topCountParam,
        selectionMode: controls.compositionSelectionMode,
        selectionDate:
          controls.compositionSelectionMode === 'fixed'
            ? effectiveSelectionDate
            : undefined,
        from: dateRange.from,
        till: dateRange.till,
        intervalDays,
      });
    },
    enabled: Boolean(
      controls.compositionTab !== 'snapshot' &&
        selectedIndex?.secid &&
        selectedIndex?.hasComposition &&
        (controls.compositionSelectionMode === 'rolling' ||
          fixedModeTickers.length > 0) &&
        topCountParam >= 0
    ),
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const series = useMemo(() => {
    return buildCompositionSeries({
      rawSeries: seriesQuery.data,
      selectionMode: controls.compositionSelectionMode,
      fixedModeTickers,
      snapshotItems,
      getPoint: (point: ProviderCompositionSeriesPoint) => {
        const time = point.tradeDate;
        const value = point.weight;
        if (typeof time !== 'string' || time.length === 0) return null;
        if (typeof value !== 'number') return null;
        return { time, value };
      },
    });
  }, [
    controls.compositionSelectionMode,
    fixedModeTickers,
    seriesQuery.data,
    snapshotItems,
  ]);

  return {
    seriesLoading: seriesQuery.isLoading,
    seriesError: Boolean(seriesQuery.error),
    series,
  };
}
