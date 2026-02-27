'use client';

import { useCallback, useMemo, useState } from 'react';
import type {
  ChartControlsUrlState,
  CompositionSelectionMode,
  CompositionTab,
} from '@/lib/charting/chart-controls-url-state';
import type {
  ChartType,
  ChartViewMode,
  IntervalKey,
  RangeKey,
} from '@/lib/charting/time-series-controls';

type ChartControlsDefaults = {
  rangeKey: RangeKey;
  intervalKey: IntervalKey;
  customFrom: string;
  customTill: string;
  viewMode: ChartViewMode;
  chartType: ChartType;
  compositionTab: CompositionTab;
  compositionSelectionMode: CompositionSelectionMode;
  compositionSelectionDate: string;
  compositionTopCount: number | null;
};

type UseChartControlsStateOptions = {
  initial?: ChartControlsUrlState;
  defaults?: Partial<ChartControlsDefaults>;
  includeChartType?: boolean;
};

const DEFAULTS: ChartControlsDefaults = {
  rangeKey: '1y',
  intervalKey: 'auto',
  customFrom: '',
  customTill: '',
  viewMode: 'price',
  chartType: 'line',
  compositionTab: 'snapshot',
  compositionSelectionMode: 'fixed',
  compositionSelectionDate: '',
  compositionTopCount: 10,
};

export function useChartControlsState({
  initial,
  defaults,
  includeChartType = false,
}: UseChartControlsStateOptions = {}) {
  const resolvedDefaults = useMemo(
    () => ({
      ...DEFAULTS,
      ...defaults,
    }),
    [defaults]
  );

  const [rangeKey, setRangeKey] = useState<RangeKey>(
    () => initial?.rangeKey ?? resolvedDefaults.rangeKey
  );
  const [intervalKey, setIntervalKey] = useState<IntervalKey>(
    () => initial?.intervalKey ?? resolvedDefaults.intervalKey
  );
  const [customFrom, setCustomFrom] = useState(
    () => initial?.customFrom ?? resolvedDefaults.customFrom
  );
  const [customTill, setCustomTill] = useState(
    () => initial?.customTill ?? resolvedDefaults.customTill
  );
  const [viewMode, setViewMode] = useState<ChartViewMode>(
    () => initial?.viewMode ?? resolvedDefaults.viewMode
  );
  const [chartType, setChartType] = useState<ChartType>(
    () => initial?.chartType ?? resolvedDefaults.chartType
  );
  const [compositionTab, setCompositionTab] = useState<CompositionTab>(
    () => initial?.compositionTab ?? resolvedDefaults.compositionTab
  );
  const [compositionSelectionMode, setCompositionSelectionMode] =
    useState<CompositionSelectionMode>(
      () =>
        initial?.compositionSelectionMode ??
        resolvedDefaults.compositionSelectionMode
    );
  const [compositionSelectionDate, setCompositionSelectionDate] = useState(
    () =>
      initial?.compositionSelectionDate ??
      resolvedDefaults.compositionSelectionDate
  );
  const [compositionTopCount, setCompositionTopCount] = useState<number | null>(
    () =>
      initial?.compositionTopCount === undefined
        ? resolvedDefaults.compositionTopCount
        : initial.compositionTopCount
  );

  const applyParsedControls = useCallback(
    (next: ChartControlsUrlState) => {
      setRangeKey(next.rangeKey ?? resolvedDefaults.rangeKey);
      setIntervalKey(next.intervalKey ?? resolvedDefaults.intervalKey);
      setCustomFrom(next.customFrom ?? resolvedDefaults.customFrom);
      setCustomTill(next.customTill ?? resolvedDefaults.customTill);
      setViewMode(next.viewMode ?? resolvedDefaults.viewMode);
      setCompositionTab(next.compositionTab ?? resolvedDefaults.compositionTab);
      setCompositionSelectionMode(
        next.compositionSelectionMode ??
          resolvedDefaults.compositionSelectionMode
      );
      setCompositionSelectionDate(
        next.compositionSelectionDate ?? resolvedDefaults.compositionSelectionDate
      );
      setCompositionTopCount(
        next.compositionTopCount === undefined
          ? resolvedDefaults.compositionTopCount
          : next.compositionTopCount
      );

      if (includeChartType) {
        setChartType(next.chartType ?? resolvedDefaults.chartType);
      }
    },
    [includeChartType, resolvedDefaults]
  );

  const controlsUrlState = useMemo(() => {
    const base = {
      rangeKey,
      intervalKey,
      customFrom,
      customTill,
      viewMode,
      compositionTab,
      compositionSelectionMode,
      compositionSelectionDate,
      compositionTopCount,
    };

    if (!includeChartType) return base;
    return {
      ...base,
      chartType,
    };
  }, [
    chartType,
    compositionSelectionDate,
    compositionSelectionMode,
    compositionTab,
    compositionTopCount,
    customFrom,
    customTill,
    includeChartType,
    intervalKey,
    rangeKey,
    viewMode,
  ]);

  const controlsStateKey = useMemo(
    () => JSON.stringify(controlsUrlState),
    [controlsUrlState]
  );

  return {
    rangeKey,
    setRangeKey,
    intervalKey,
    setIntervalKey,
    customFrom,
    setCustomFrom,
    customTill,
    setCustomTill,
    viewMode,
    setViewMode,
    chartType,
    setChartType,
    compositionTab,
    setCompositionTab,
    compositionSelectionMode,
    setCompositionSelectionMode,
    compositionSelectionDate,
    setCompositionSelectionDate,
    compositionTopCount,
    setCompositionTopCount,
    controlsUrlState,
    controlsStateKey,
    applyParsedControls,
  };
}
