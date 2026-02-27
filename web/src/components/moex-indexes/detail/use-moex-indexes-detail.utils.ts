import {
  QUICK_INTERVAL_KEYS,
  QUICK_RANGE_KEYS,
  buildChartTypeOptions,
  buildExtraIntervalOptions,
  buildExtraRangeOptions,
  buildIntervalOptions,
  buildRangeOptions,
  buildViewModeOptions,
  resolveDateRange,
  resolveIntervalDays,
} from '@/lib/charting/time-series-controls';

export {
  QUICK_INTERVAL_KEYS,
  QUICK_RANGE_KEYS,
  resolveDateRange,
  resolveIntervalDays,
};

export const RANGE_OPTIONS = buildRangeOptions('moex.chart');
export const EXTRA_RANGE_OPTIONS = buildExtraRangeOptions('moex.chart');
export const INTERVAL_OPTIONS = buildIntervalOptions('moex.chart');
export const EXTRA_INTERVAL_OPTIONS = buildExtraIntervalOptions('moex.chart');
export const VIEW_MODE_OPTIONS = buildViewModeOptions('moex.chart');
export const CHART_TYPE_OPTIONS = buildChartTypeOptions('moex.chart');
