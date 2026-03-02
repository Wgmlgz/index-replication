import type { CompositionSelectionMode, CompositionTab } from '@/lib/charting/chart-controls-url-state';
import type {
  ChartType,
  ChartViewMode,
  IntervalKey,
  RangeKey,
} from '@/lib/charting/time-series-controls';
import type {
  BaseRangeControls,
  CompositionDataControls,
  PriceDataControls,
} from '@/components/charts-new/types/controls';

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

const INTERVAL_KEYS: IntervalKey[] = ['auto', '1d', '2d', '3d', '1w', '2w', '1m'];
const CHART_VIEW_MODES: ChartViewMode[] = ['price', 'percent'];
const CHART_TYPES: ChartType[] = ['line', 'candlestick'];
const COMPOSITION_TABS: CompositionTab[] = ['snapshot', 'trend', 'stacked'];
const COMPOSITION_SELECTION_MODES: CompositionSelectionMode[] = [
  'fixed',
  'rolling',
];

export const CHARTS_NEW_URL_KEYS = {
  price: {
    rangeKey: 'cn_pr',
    intervalKey: 'cn_pi',
    customFrom: 'cn_pf',
    customTill: 'cn_pt',
    viewMode: 'cn_pv',
    chartType: 'cn_pct',
  },
  composition: {
    rangeKey: 'cn_cr',
    intervalKey: 'cn_ci',
    customFrom: 'cn_cf',
    customTill: 'cn_ct',
    selectionMode: 'cn_cm',
    selectionDate: 'cn_cd',
    tab: 'cn_tab',
    topCount: 'cn_top',
  },
} as const;

type SearchParamsLike = Pick<URLSearchParams, 'get'>;

export type ChartsNewControlsState = {
  price: PriceDataControls;
  composition: CompositionDataControls;
};

export type ChartsNewControlsDefaults = ChartsNewControlsState;

const parseEnum = <T extends string>(
  raw: string | null,
  values: readonly T[]
): T | undefined => {
  if (!raw) return undefined;
  return values.includes(raw as T) ? (raw as T) : undefined;
};

const parsePositiveInt = (raw: string | null): number | undefined => {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

type BaseRangeKeys = {
  rangeKey: string;
  intervalKey: string;
  customFrom: string;
  customTill: string;
};

function parseBaseRangeControls(
  searchParams: SearchParamsLike,
  keys: BaseRangeKeys,
  defaults: BaseRangeControls
): BaseRangeControls {
  const rangeKey =
    parseEnum(searchParams.get(keys.rangeKey), RANGE_KEYS) ?? defaults.rangeKey;
  const intervalKey =
    parseEnum(searchParams.get(keys.intervalKey), INTERVAL_KEYS) ??
    defaults.intervalKey;

  const rawFrom = searchParams.get(keys.customFrom);
  const rawTill = searchParams.get(keys.customTill);

  return {
    rangeKey,
    intervalKey,
    customFrom: rawFrom && rawFrom.length > 0 ? rawFrom : defaults.customFrom,
    customTill: rawTill && rawTill.length > 0 ? rawTill : defaults.customTill,
  };
}

function applyBaseRangeControls(
  params: URLSearchParams,
  keys: BaseRangeKeys,
  state: BaseRangeControls,
  defaults: BaseRangeControls
) {
  params.delete(keys.rangeKey);
  params.delete(keys.intervalKey);
  params.delete(keys.customFrom);
  params.delete(keys.customTill);

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
}

export function parseChartsNewControlsUrlState(
  searchParams: SearchParamsLike,
  defaults: ChartsNewControlsDefaults
): ChartsNewControlsState {
  const priceBase = parseBaseRangeControls(
    searchParams,
    CHARTS_NEW_URL_KEYS.price,
    defaults.price
  );
  const compositionBase = parseBaseRangeControls(
    searchParams,
    CHARTS_NEW_URL_KEYS.composition,
    defaults.composition
  );

  const viewMode =
    parseEnum(searchParams.get(CHARTS_NEW_URL_KEYS.price.viewMode), CHART_VIEW_MODES) ??
    defaults.price.viewMode;
  const chartType =
    parseEnum(searchParams.get(CHARTS_NEW_URL_KEYS.price.chartType), CHART_TYPES) ??
    defaults.price.chartType;

  const compositionSelectionMode =
    parseEnum(
      searchParams.get(CHARTS_NEW_URL_KEYS.composition.selectionMode),
      COMPOSITION_SELECTION_MODES
    ) ?? defaults.composition.compositionSelectionMode;
  const compositionTab =
    parseEnum(searchParams.get(CHARTS_NEW_URL_KEYS.composition.tab), COMPOSITION_TABS) ??
    defaults.composition.compositionTab;

  const selectionDateRaw = searchParams.get(CHARTS_NEW_URL_KEYS.composition.selectionDate);
  const compositionSelectionDate =
    selectionDateRaw && selectionDateRaw.length > 0
      ? selectionDateRaw
      : defaults.composition.compositionSelectionDate;

  const topCountRaw = searchParams.get(CHARTS_NEW_URL_KEYS.composition.topCount);
  const normalizedTopCount = topCountRaw?.trim().toLowerCase();
  let topCount = defaults.composition.topCount;
  if (normalizedTopCount === 'all' || normalizedTopCount === '0') {
    topCount = null;
  } else {
    const parsedTopCount = parsePositiveInt(topCountRaw);
    if (typeof parsedTopCount === 'number') {
      topCount = parsedTopCount;
    }
  }

  return {
    price: {
      ...priceBase,
      viewMode,
      chartType,
    },
    composition: {
      ...compositionBase,
      compositionSelectionMode,
      compositionSelectionDate,
      compositionTab,
      topCount,
    },
  };
}

export function applyChartsNewControlsUrlState(
  params: URLSearchParams,
  state: ChartsNewControlsState,
  defaults: ChartsNewControlsDefaults
) {
  applyBaseRangeControls(
    params,
    CHARTS_NEW_URL_KEYS.price,
    state.price,
    defaults.price
  );
  params.delete(CHARTS_NEW_URL_KEYS.price.viewMode);
  params.delete(CHARTS_NEW_URL_KEYS.price.chartType);

  if (state.price.viewMode !== defaults.price.viewMode) {
    params.set(CHARTS_NEW_URL_KEYS.price.viewMode, state.price.viewMode);
  }
  if (state.price.chartType !== defaults.price.chartType) {
    params.set(CHARTS_NEW_URL_KEYS.price.chartType, state.price.chartType);
  }

  applyBaseRangeControls(
    params,
    CHARTS_NEW_URL_KEYS.composition,
    state.composition,
    defaults.composition
  );
  params.delete(CHARTS_NEW_URL_KEYS.composition.selectionMode);
  params.delete(CHARTS_NEW_URL_KEYS.composition.selectionDate);
  params.delete(CHARTS_NEW_URL_KEYS.composition.tab);
  params.delete(CHARTS_NEW_URL_KEYS.composition.topCount);

  if (
    state.composition.compositionSelectionMode !==
    defaults.composition.compositionSelectionMode
  ) {
    params.set(
      CHARTS_NEW_URL_KEYS.composition.selectionMode,
      state.composition.compositionSelectionMode
    );
  }

  const compositionSelectionDate = state.composition.compositionSelectionDate.trim();
  if (compositionSelectionDate.length > 0) {
    params.set(
      CHARTS_NEW_URL_KEYS.composition.selectionDate,
      compositionSelectionDate
    );
  }

  if (state.composition.compositionTab !== defaults.composition.compositionTab) {
    params.set(CHARTS_NEW_URL_KEYS.composition.tab, state.composition.compositionTab);
  }

  if (state.composition.topCount === null) {
    params.set(CHARTS_NEW_URL_KEYS.composition.topCount, 'all');
  } else if (
    typeof state.composition.topCount === 'number' &&
    state.composition.topCount !== defaults.composition.topCount
  ) {
    params.set(
      CHARTS_NEW_URL_KEYS.composition.topCount,
      String(state.composition.topCount)
    );
  }
}

