import type {
  ChartType,
  ChartViewMode,
  IntervalKey,
  RangeKey,
} from './time-series-controls';
import {
  isOneOf,
  parsePositiveInt,
  type SearchParamsLike,
} from '@/lib/url-state/search-params';

export type CompositionTab = 'snapshot' | 'trend' | 'stacked';
export type CompositionSelectionMode = 'fixed' | 'rolling';

const RANGE_KEYS: RangeKey[] = [
  '1m',
  '3m',
  '6m',
  'ytd',
  '1y',
  '3y',
  '5y',
  'max',
  'custom',
];

const INTERVAL_KEYS: IntervalKey[] = [
  'auto',
  '1d',
  '2d',
  '3d',
  '1w',
  '2w',
  '1m',
];

const CHART_VIEW_MODES: ChartViewMode[] = ['price', 'percent'];
const CHART_TYPES: ChartType[] = ['line', 'candlestick'];
const COMPOSITION_TABS: CompositionTab[] = ['snapshot', 'trend', 'stacked'];
const COMPOSITION_SELECTION_MODES: CompositionSelectionMode[] = [
  'fixed',
  'rolling',
];

export type ChartControlsUrlState = Partial<{
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
}>;

export type ChartControlsUrlKeys = {
  rangeKey: string;
  intervalKey: string;
  customFrom: string;
  customTill: string;
  viewMode: string;
  chartType?: string;
  compositionTab?: string;
  compositionSelectionMode?: string;
  compositionSelectionDate?: string;
  compositionTopCount?: string;
};

export type ChartControlsUrlDefaults = {
  rangeKey: RangeKey;
  intervalKey: IntervalKey;
  viewMode: ChartViewMode;
  chartType?: ChartType;
  compositionTab?: CompositionTab;
  compositionSelectionMode?: CompositionSelectionMode;
  compositionTopCount?: number | null;
};

export type ChartControlsUrlCodecConfig = {
  keys: ChartControlsUrlKeys;
  defaults: ChartControlsUrlDefaults;
};

export function parseChartControlsUrlState(
  searchParams: SearchParamsLike,
  config: ChartControlsUrlCodecConfig
): ChartControlsUrlState {
  const { keys } = config;
  const parsed: ChartControlsUrlState = {};

  const rangeRaw = searchParams.get(keys.rangeKey);
  if (isOneOf(rangeRaw, RANGE_KEYS)) {
    parsed.rangeKey = rangeRaw;
  }

  const intervalRaw = searchParams.get(keys.intervalKey);
  if (isOneOf(intervalRaw, INTERVAL_KEYS)) {
    parsed.intervalKey = intervalRaw;
  }

  const customFrom = searchParams.get(keys.customFrom);
  if (customFrom) parsed.customFrom = customFrom;

  const customTill = searchParams.get(keys.customTill);
  if (customTill) parsed.customTill = customTill;

  const viewRaw = searchParams.get(keys.viewMode);
  if (isOneOf(viewRaw, CHART_VIEW_MODES)) {
    parsed.viewMode = viewRaw;
  }

  if (keys.chartType) {
    const typeRaw = searchParams.get(keys.chartType);
    if (isOneOf(typeRaw, CHART_TYPES)) {
      parsed.chartType = typeRaw;
    }
  }

  if (keys.compositionTab) {
    const tabRaw = searchParams.get(keys.compositionTab);
    if (isOneOf(tabRaw, COMPOSITION_TABS)) {
      parsed.compositionTab = tabRaw;
    }
  }

  if (keys.compositionSelectionMode) {
    const selectionModeRaw = searchParams.get(keys.compositionSelectionMode);
    if (isOneOf(selectionModeRaw, COMPOSITION_SELECTION_MODES)) {
      parsed.compositionSelectionMode = selectionModeRaw;
    }
  }

  if (keys.compositionSelectionDate) {
    const compositionSelectionDate = searchParams.get(
      keys.compositionSelectionDate
    );
    if (compositionSelectionDate) {
      parsed.compositionSelectionDate = compositionSelectionDate;
    }
  }

  if (keys.compositionTopCount) {
    const topCountRaw = searchParams.get(keys.compositionTopCount);
    const normalizedTopCount = topCountRaw?.trim().toLowerCase();
    if (normalizedTopCount === 'all' || normalizedTopCount === '0') {
      parsed.compositionTopCount = null;
    } else {
      const parsedTopCount = parsePositiveInt(topCountRaw);
      if (typeof parsedTopCount === 'number') {
        parsed.compositionTopCount = parsedTopCount;
      }
    }
  }

  return parsed;
}

export function applyChartControlsUrlState(
  params: URLSearchParams,
  state: {
    rangeKey: RangeKey;
    intervalKey: IntervalKey;
    customFrom: string;
    customTill: string;
    viewMode: ChartViewMode;
    chartType?: ChartType;
    compositionTab?: CompositionTab;
    compositionSelectionMode?: CompositionSelectionMode;
    compositionSelectionDate?: string;
    compositionTopCount?: number | null;
  },
  config: ChartControlsUrlCodecConfig
) {
  const { keys, defaults } = config;

  params.delete(keys.rangeKey);
  params.delete(keys.intervalKey);
  params.delete(keys.customFrom);
  params.delete(keys.customTill);
  params.delete(keys.viewMode);
  if (keys.chartType) params.delete(keys.chartType);
  if (keys.compositionTab) params.delete(keys.compositionTab);
  if (keys.compositionSelectionMode) params.delete(keys.compositionSelectionMode);
  if (keys.compositionSelectionDate) params.delete(keys.compositionSelectionDate);
  if (keys.compositionTopCount) params.delete(keys.compositionTopCount);

  if (state.rangeKey !== defaults.rangeKey) {
    params.set(keys.rangeKey, state.rangeKey);
  }

  if (state.intervalKey !== defaults.intervalKey) {
    params.set(keys.intervalKey, state.intervalKey);
  }

  if (state.rangeKey === 'custom') {
    const customFrom = state.customFrom.trim();
    const customTill = state.customTill.trim();
    if (customFrom.length > 0) {
      params.set(keys.customFrom, customFrom);
    }
    if (customTill.length > 0) {
      params.set(keys.customTill, customTill);
    }
  }

  if (state.viewMode !== defaults.viewMode) {
    params.set(keys.viewMode, state.viewMode);
  }

  if (keys.chartType && state.chartType && defaults.chartType) {
    if (state.chartType !== defaults.chartType) {
      params.set(keys.chartType, state.chartType);
    }
  }

  if (keys.compositionTab && state.compositionTab && defaults.compositionTab) {
    if (state.compositionTab !== defaults.compositionTab) {
      params.set(keys.compositionTab, state.compositionTab);
    }
  }

  if (
    keys.compositionSelectionMode &&
    state.compositionSelectionMode &&
    defaults.compositionSelectionMode
  ) {
    if (state.compositionSelectionMode !== defaults.compositionSelectionMode) {
      params.set(keys.compositionSelectionMode, state.compositionSelectionMode);
    }
  }

  if (keys.compositionSelectionDate && state.compositionSelectionDate) {
    const compositionSelectionDate = state.compositionSelectionDate.trim();
    if (compositionSelectionDate.length > 0) {
      params.set(keys.compositionSelectionDate, compositionSelectionDate);
    }
  }

  if (keys.compositionTopCount && defaults.compositionTopCount !== undefined) {
    if (state.compositionTopCount === null) {
      params.set(keys.compositionTopCount, 'all');
    } else if (
      typeof state.compositionTopCount === 'number' &&
      state.compositionTopCount !== defaults.compositionTopCount
    ) {
      params.set(keys.compositionTopCount, String(state.compositionTopCount));
    }
  }
}
