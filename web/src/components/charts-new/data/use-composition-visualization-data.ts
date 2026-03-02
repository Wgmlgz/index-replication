'use client';

import type { MoexIndex } from '@/api-client';
import type { CompositionDataControls } from '@/components/charts-new/types/controls';
import type { CompositionVisualizationDataState } from './chart-query.types';
import type { ChartsDataProvider } from './providers';
import { useCompositionSeriesData } from './use-composition-series-data';
import { useCompositionSnapshotData } from './use-composition-snapshot-data';

export function useCompositionVisualizationData(options: {
  selectedIndex: MoexIndex | null;
  latestTradeDate: string | null;
  controls: CompositionDataControls;
  provider: ChartsDataProvider;
}): CompositionVisualizationDataState {
  const snapshotState = useCompositionSnapshotData({
    selectedIndex: options.selectedIndex,
    latestTradeDate: options.latestTradeDate,
    provider: options.provider,
    controls: {
      rangeKey: options.controls.rangeKey,
      intervalKey: options.controls.intervalKey,
      customFrom: options.controls.customFrom,
      customTill: options.controls.customTill,
      compositionSelectionMode: options.controls.compositionSelectionMode,
      compositionSelectionDate: options.controls.compositionSelectionDate,
    },
  });

  const seriesState = useCompositionSeriesData({
    selectedIndex: options.selectedIndex,
    provider: options.provider,
    snapshotItems: snapshotState.snapshotItems,
    effectiveSelectionDate: snapshotState.effectiveSelectionDate,
    dateRange: snapshotState.dateRange,
    intervalDays: snapshotState.intervalDays,
    controls: {
      compositionSelectionMode: options.controls.compositionSelectionMode,
      compositionTab: options.controls.compositionTab,
      topCount: options.controls.topCount,
    },
  });

  return {
    snapshotLoading: snapshotState.snapshotLoading,
    snapshotError: snapshotState.snapshotError,
    snapshotDate: snapshotState.snapshotDate,
    snapshotItems: snapshotState.snapshotItems,
    seriesLoading: seriesState.seriesLoading,
    seriesError: seriesState.seriesError,
    series: seriesState.series,
  };
}
