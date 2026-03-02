'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  MoexIndex,
  MoexIndexTickerAnalyticsPoint,
} from '@/api-client';
import type { CompositionSnapshotItem } from '@/components/charts-new/visualization/chart-types';
import { moexApi } from '@/lib/api';
import type { CompositionDataControls } from '@/components/charts-new/types/controls';
import type { CompositionSeriesDataState } from './chart-query.types';
import {
  buildCompositionSeries,
  resolveCompositionTopCountParam,
  resolveFixedModeTickers,
} from './data-analytics';

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
}): CompositionSeriesDataState {
  const {
    selectedIndex,
    snapshotItems,
    effectiveSelectionDate,
    dateRange,
    intervalDays,
    controls,
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
      const response = await moexApi.moexIndexesSecidCompositionSeriesGet(
        selectedIndex!.secid ?? '',
        controls.compositionSelectionMode === 'fixed' ? fixedModeTickersParam : '',
        topCountParam,
        controls.compositionSelectionMode,
        controls.compositionSelectionMode === 'fixed'
          ? effectiveSelectionDate
          : undefined,
        dateRange.from,
        dateRange.till,
        intervalDays,
        undefined
      );
      return response.data;
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
      getPoint: (point: MoexIndexTickerAnalyticsPoint) => {
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
