import type { ChartData } from './index-chart';
import type { ChartViewMode } from '@/lib/charting/time-series-controls';

export type TimeSeriesValuePoint = {
  time: string;
  value: number;
};

export const createViewModeNormalizer = (
  baseValue: number | null,
  viewMode: ChartViewMode
) => {
  const usePercent =
    viewMode === 'percent' && baseValue !== null && baseValue !== 0;

  return (value: number | null) => {
    if (value === null) return null;
    if (!usePercent || baseValue === null) return value;
    return ((value - baseValue) / baseValue) * 100;
  };
};

export const buildLineChartData = (
  points: TimeSeriesValuePoint[],
  viewMode: ChartViewMode
): ChartData => {
  const baseValue = points[0]?.value ?? null;
  const normalizeValue = createViewModeNormalizer(baseValue, viewMode);

  return points
    .map((point) => {
      const value = normalizeValue(point.value);
      if (value === null) return null;
      return {
        time: point.time,
        value,
      };
    })
    .filter((point): point is { time: string; value: number } => point !== null);
};

export const calculateChangeStats = (
  values: number[]
): {
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
} => {
  const latestValue = values[values.length - 1] ?? null;
  const previousValue = values[values.length - 2] ?? null;
  const change =
    latestValue !== null && previousValue !== null
      ? latestValue - previousValue
      : null;
  const changePercent =
    change !== null && previousValue ? (change / previousValue) * 100 : null;

  return {
    latestValue,
    change,
    changePercent,
  };
};
