import { format, startOfYear, subMonths, subYears } from 'date-fns';
import type { ChartType, ChartViewMode, RangeKey } from './moex-indexes-detail.types';

export const RANGE_OPTIONS: Array<{ value: RangeKey; labelKey: string }> = [
  { value: '1m', labelKey: 'moex.chart.range.1m' },
  { value: '3m', labelKey: 'moex.chart.range.3m' },
  { value: '6m', labelKey: 'moex.chart.range.6m' },
  { value: 'ytd', labelKey: 'moex.chart.range.ytd' },
  { value: '1y', labelKey: 'moex.chart.range.1y' },
  { value: '3y', labelKey: 'moex.chart.range.3y' },
  { value: '5y', labelKey: 'moex.chart.range.5y' },
  { value: 'max', labelKey: 'moex.chart.range.max' },
  { value: 'custom', labelKey: 'moex.chart.range.custom' },
];

export const QUICK_RANGE_KEYS: RangeKey[] = ['1m', '3m', '6m', 'ytd', '1y'];

export const EXTRA_RANGE_OPTIONS = RANGE_OPTIONS.filter(
  (option) => !QUICK_RANGE_KEYS.includes(option.value)
);

export const VIEW_MODE_OPTIONS: Array<{
  value: ChartViewMode;
  labelKey: string;
}> = [
  { value: 'price', labelKey: 'moex.chart.view.price' },
  { value: 'percent', labelKey: 'moex.chart.view.percent' },
];

export const CHART_TYPE_OPTIONS: Array<{
  value: ChartType;
  labelKey: string;
}> = [
  { value: 'line', labelKey: 'moex.chart.type.line' },
  { value: 'candlestick', labelKey: 'moex.chart.type.candlestick' },
];

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
