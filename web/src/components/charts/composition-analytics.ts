import type { CompositionSelectionMode } from '@/lib/charting/chart-controls-url-state';
import type { ChartData } from './index-chart';
import type {
  CompositionSeries,
  CompositionSeriesPoint,
  CompositionSnapshotItem,
} from './types';

export const COMPOSITION_OTHER_THRESHOLD = 0.01;

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
  if (topCountParam === 0) return snapshotItems.map((item) => item.ticker);
  return snapshotItems.slice(0, topCountParam).map((item) => item.ticker);
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
      : options.snapshotItems.map((item) => item.ticker);
  const orderedTickers = baseOrder.filter((ticker) => keys.has(ticker));
  const leftovers = Object.keys(data)
    .filter((ticker) => !orderedTickers.includes(ticker))
    .sort((a, b) => a.localeCompare(b));
  const nameMap = new Map(
    options.snapshotItems.map((item) => [item.ticker, item.name])
  );

  return [...orderedTickers, ...leftovers]
    .map((ticker) => {
      const points = (data[ticker] ?? [])
        .map(options.getPoint)
        .filter(
          (point): point is CompositionSeriesPoint => point !== null
        )
        .sort((a, b) => a.time.localeCompare(b.time));

      return {
        id: ticker,
        name: nameMap.get(ticker) ?? ticker,
        data: points,
      };
    })
    .filter((item) => item.data.length > 0);
}

export const calculateSnapshotOtherWeight = (
  items: CompositionSnapshotItem[]
) => {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return Math.max(0, 100 - total);
};

export const buildSnapshotChartItems = (
  snapshotTop: CompositionSnapshotItem[],
  options: {
    otherLabel: string;
    snapshotDate?: string | null;
    threshold?: number;
  }
) => {
  const threshold = options.threshold ?? COMPOSITION_OTHER_THRESHOLD;
  const otherWeight = calculateSnapshotOtherWeight(snapshotTop);
  if (otherWeight <= threshold) {
    return { snapshotChartItems: snapshotTop, snapshotOtherWeight: otherWeight };
  }

  return {
    snapshotChartItems: [
      ...snapshotTop,
      {
        ticker: options.otherLabel,
        secId: '',
        name: options.otherLabel,
        weight: otherWeight,
        tradeDate: options.snapshotDate ?? '',
      },
    ],
    snapshotOtherWeight: otherWeight,
  };
};

export const resolveChartDataLastDate = (chartData: ChartData): string | null => {
  if (chartData.length === 0) return null;
  const last = chartData[chartData.length - 1] as { time?: unknown };
  const time = last?.time;
  if (!time) return null;
  if (typeof time === 'string') return time;
  if (typeof time === 'number') {
    return new Date(time * 1000).toISOString().slice(0, 10);
  }
  if (typeof time === 'object') {
    const timeObj = time as { year?: number; month?: number; day?: number };
    if (timeObj.year && timeObj.month && timeObj.day) {
      const month = String(timeObj.month).padStart(2, '0');
      const day = String(timeObj.day).padStart(2, '0');
      return `${timeObj.year}-${month}-${day}`;
    }
  }
  return null;
};
