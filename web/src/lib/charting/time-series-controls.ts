import { format, startOfYear, subMonths, subYears } from 'date-fns';

export type RangeKey =
  | '1m'
  | '3m'
  | '6m'
  | 'ytd'
  | '1y'
  | '3y'
  | '5y'
  | 'max'
  | 'custom';

export type IntervalKey = 'auto' | '1d' | '2d' | '3d' | '1w' | '2w' | '1m';
export type ChartViewMode = 'price' | 'percent';
export type ChartType = 'line' | 'candlestick';

export const QUICK_RANGE_KEYS: RangeKey[] = ['1m', '3m', '6m', 'ytd', '1y'];
export const QUICK_INTERVAL_KEYS: IntervalKey[] = ['auto', '1d', '1w'];

export const buildRangeOptions = (
  keyPrefix: string
): Array<{ value: RangeKey; labelKey: string }> => [
  { value: '1m', labelKey: `${keyPrefix}.range.1m` },
  { value: '3m', labelKey: `${keyPrefix}.range.3m` },
  { value: '6m', labelKey: `${keyPrefix}.range.6m` },
  { value: 'ytd', labelKey: `${keyPrefix}.range.ytd` },
  { value: '1y', labelKey: `${keyPrefix}.range.1y` },
  { value: '3y', labelKey: `${keyPrefix}.range.3y` },
  { value: '5y', labelKey: `${keyPrefix}.range.5y` },
  { value: 'max', labelKey: `${keyPrefix}.range.max` },
  { value: 'custom', labelKey: `${keyPrefix}.range.custom` },
];

export const buildIntervalOptions = (
  keyPrefix: string
): Array<{ value: IntervalKey; labelKey: string }> => [
  { value: 'auto', labelKey: `${keyPrefix}.interval.auto` },
  { value: '1d', labelKey: `${keyPrefix}.interval.1d` },
  { value: '2d', labelKey: `${keyPrefix}.interval.2d` },
  { value: '3d', labelKey: `${keyPrefix}.interval.3d` },
  { value: '1w', labelKey: `${keyPrefix}.interval.1w` },
  { value: '2w', labelKey: `${keyPrefix}.interval.2w` },
  { value: '1m', labelKey: `${keyPrefix}.interval.1m` },
];

export const buildViewModeOptions = (
  keyPrefix: string
): Array<{ value: ChartViewMode; labelKey: string }> => [
  { value: 'price', labelKey: `${keyPrefix}.view.price` },
  { value: 'percent', labelKey: `${keyPrefix}.view.percent` },
];

export const buildChartTypeOptions = (
  keyPrefix: string
): Array<{ value: ChartType; labelKey: string }> => [
  { value: 'line', labelKey: `${keyPrefix}.type.line` },
  { value: 'candlestick', labelKey: `${keyPrefix}.type.candlestick` },
];

export const buildExtraRangeOptions = (keyPrefix: string) =>
  buildRangeOptions(keyPrefix).filter(
    option => !QUICK_RANGE_KEYS.includes(option.value)
  );

export const buildExtraIntervalOptions = (keyPrefix: string) =>
  buildIntervalOptions(keyPrefix).filter(
    option => !QUICK_INTERVAL_KEYS.includes(option.value)
  );

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

export const resolveDateRange = (
  rangeKey: RangeKey,
  customFrom: string,
  customTill: string
) => {
  const today = new Date();
  const till = formatDate(today);

  switch (rangeKey) {
    case '1m':
      return { from: formatDate(subMonths(today, 1)), till };
    case '3m':
      return { from: formatDate(subMonths(today, 3)), till };
    case '6m':
      return { from: formatDate(subMonths(today, 6)), till };
    case 'ytd':
      return { from: formatDate(startOfYear(today)), till };
    case '1y':
      return { from: formatDate(subYears(today, 1)), till };
    case '3y':
      return { from: formatDate(subYears(today, 3)), till };
    case '5y':
      return { from: formatDate(subYears(today, 5)), till };
    case 'max':
      return { from: undefined, till };
    case 'custom': {
      const from = customFrom || undefined;
      const customTo = customTill || undefined;
      if (from && customTo && from > customTo) {
        return { from: customTo, till: from };
      }
      return { from, till: customTo ?? till };
    }
    default:
      return { from: formatDate(subYears(today, 1)), till };
  }
};

export const INTERVAL_DAYS: Record<Exclude<IntervalKey, 'auto'>, number> = {
  '1d': 1,
  '2d': 2,
  '3d': 3,
  '1w': 7,
  '2w': 14,
  '1m': 30,
};

export const resolveIntervalDays = (intervalKey: IntervalKey) => {
  if (intervalKey === 'auto') return undefined;
  return INTERVAL_DAYS[intervalKey];
};
