import type {
  CompositionSnapshotItem,
  PriceChartData,
  PriceLinePoint,
} from '@/components/charts-new/visualization';

export const resolveLatestTradeDate = (data: PriceChartData): string | null => {
  if (data.length === 0) return null;
  const lastPoint = data[data.length - 1];
  if (!lastPoint || typeof lastPoint.time !== 'string') return null;
  return lastPoint.time.length > 0 ? lastPoint.time : null;
};

export const toLineData = (data: PriceChartData): PriceLinePoint[] => {
  return data.map(point => ({
    time: point.time,
    value: 'value' in point ? point.value : point.close,
  }));
};

export const normalizeLineSeriesFrom = (
  data: PriceLinePoint[],
  startTime: string,
): PriceLinePoint[] => {
  const startIndex = data.findIndex(point => point.time >= startTime);
  if (startIndex < 0) {
    return [];
  }

  const baseValue = data[startIndex]?.value ?? 0;
  if (baseValue <= 0) {
    return [];
  }

  return data.slice(startIndex).map(point => ({
    time: point.time,
    value: (point.value / baseValue) * 100,
  }));
};

export const resolveNormalizationStart = (
  portfolioData: PriceLinePoint[],
  benchmarkData: PriceLinePoint[],
): string | null => {
  if (portfolioData.length === 0 || benchmarkData.length === 0) {
    return null;
  }

  const benchmarkByTime = new Map(benchmarkData.map(point => [point.time, point.value]));
  for (const point of portfolioData) {
    const benchmarkValue = benchmarkByTime.get(point.time);
    if (!benchmarkValue) {
      continue;
    }
    if (point.value > 0 && benchmarkValue > 0) {
      return point.time;
    }
  }

  const commonStart = portfolioData[0]?.time;
  const benchmarkStart = benchmarkData[0]?.time;
  if (!commonStart || !benchmarkStart) {
    return null;
  }

  return commonStart > benchmarkStart ? commonStart : benchmarkStart;
};

export function resolveSnapshotKey(item: CompositionSnapshotItem): string {
  const ticker = item.ticker;
  if (ticker.length > 0) return ticker;
  return item.secId;
}
