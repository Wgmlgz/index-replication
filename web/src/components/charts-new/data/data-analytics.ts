import type { CompositionSelectionMode } from '@/lib/charting/chart-controls-url-state';
import type { ChartViewMode } from '@/lib/charting/time-series-controls';
import type {
  CompositionLegendRow,
  CompositionSeries,
  CompositionSeriesPoint,
  CompositionSnapshotItem,
} from '@/components/charts-new/visualization/chart-types';

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

export const normalizeIsoDate = (
  value: string | null | undefined
): string | undefined => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  return normalized;
};

export const resolveCompositionTopCountParam = (
  topCount: number,
  options?: {
    fallback?: number;
    treatMaxSafeIntegerAsAll?: boolean;
  }
) => {
  const fallback = options?.fallback ?? 10;
  if (!Number.isFinite(topCount)) return fallback;
  if (options?.treatMaxSafeIntegerAsAll && topCount >= Number.MAX_SAFE_INTEGER) {
    return 0;
  }
  if (topCount < 0) return 0;
  return Math.floor(topCount);
};

export const resolveFixedModeTickers = (
  selectionMode: CompositionSelectionMode,
  topCountParam: number,
  snapshotItems: CompositionSnapshotItem[]
) => {
  if (selectionMode !== 'fixed') return [] as string[];
  if (topCountParam === 0) return snapshotItems.map(item => item.ticker);
  return snapshotItems.slice(0, topCountParam).map(item => item.ticker);
};

export function buildCompositionSeries<TRawPoint>(options: {
  rawSeries: Record<string, TRawPoint[]> | null | undefined;
  selectionMode: CompositionSelectionMode;
  fixedModeTickers: string[];
  snapshotItems: CompositionSnapshotItem[];
  getPoint: (point: TRawPoint) => CompositionSeriesPoint | null;
}): CompositionSeries[] {
  const data = options.rawSeries ?? {};
  const keys = new Set(Object.keys(data));
  const baseOrder =
    options.selectionMode === 'fixed'
      ? options.fixedModeTickers
      : options.snapshotItems.map(item => item.ticker);
  const orderedTickers = baseOrder.filter(ticker => keys.has(ticker));
  const leftovers = Object.keys(data)
    .filter(ticker => !orderedTickers.includes(ticker))
    .sort((a, b) => a.localeCompare(b));
  const nameMap = new Map(
    options.snapshotItems.map(item => [item.ticker, item.name])
  );

  return [...orderedTickers, ...leftovers]
    .map(ticker => {
      const points = (data[ticker] ?? [])
        .map(options.getPoint)
        .filter((point): point is CompositionSeriesPoint => point !== null)
        .sort((a, b) => a.time.localeCompare(b.time));

      return {
        id: ticker,
        name: nameMap.get(ticker) ?? ticker,
        data: points,
      };
    })
    .filter(item => item.data.length > 0);
}

export const calculateSnapshotOtherWeight = (
  items: CompositionSnapshotItem[]
) => {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return Math.max(0, 100 - total);
};

export const buildCompositionLegendRows = (
  series: CompositionSeries[],
  snapshotItems: CompositionSnapshotItem[]
): CompositionLegendRow[] => {
  const snapshotByTicker = new Map(snapshotItems.map(item => [item.ticker, item]));

  return series.map(item => {
    const latestPoint = item.data[item.data.length - 1];
    const snapshotPoint = snapshotByTicker.get(item.id);

    return {
      ticker: item.id,
      name: item.name,
      latestWeight: latestPoint?.value ?? null,
      latestDate: latestPoint?.time ?? null,
      snapshotWeight: snapshotPoint?.weight ?? null,
    };
  });
};
