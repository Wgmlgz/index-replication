'use client';

import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type {
  PriceCandlestickPoint,
  PriceCandlestickSeriesOptions,
  PriceLinePoint,
  PriceLineSeriesOptions,
  PriceVisualizationSeries,
} from './chart-types';

type PriceVisualizationProps = {
  loading: boolean;
  hasError?: boolean;
  errorMessage?: string;
  noDataMessage: string;
  series: PriceVisualizationSeries[];
  visibleRange?: {
    from?: string;
    till?: string;
  };
  className?: string;
  skeletonClassName?: string;
};

const MIN_CHART_HEIGHT = 200;
const DEFAULT_LINE_COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#dc2626', '#0891b2'];

type ChartSeriesApi = ISeriesApi<'Line'> | ISeriesApi<'Candlestick'>;

const DEFAULT_LINE_OPTIONS: PriceLineSeriesOptions = {
  color: DEFAULT_LINE_COLORS[0],
  lineWidth: 2,
};

const DEFAULT_CANDLESTICK_OPTIONS: PriceCandlestickSeriesOptions = {
  upColor: '#16a34a',
  downColor: '#dc2626',
  wickUpColor: '#16a34a',
  wickDownColor: '#dc2626',
  borderVisible: false,
};

type WhitespacePoint = { time: string };

const parseIsoDay = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toIsoDay = (value: Date): string => value.toISOString().slice(0, 10);

const dailySteps = (start: Date, end: Date): string[] => {
  const normalizedStart = new Date(start.getTime());
  normalizedStart.setUTCHours(0, 0, 0, 0);
  const normalizedEnd = new Date(end.getTime());
  normalizedEnd.setUTCHours(0, 0, 0, 0);

  if (normalizedStart.getTime() > normalizedEnd.getTime()) {
    return [];
  }

  const result: string[] = [];
  for (
    let cursor = normalizedStart;
    cursor.getTime() <= normalizedEnd.getTime();
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    result.push(toIsoDay(cursor));
  }
  return result;
};

const resolveBounds = <T extends { time: string }>(
  data: T[],
  from?: string,
  till?: string
): { start: Date; end: Date } | null => {
  if (data.length === 0) return null;
  const firstDataDate = parseIsoDay(data[0].time);
  const lastDataDate = parseIsoDay(data[data.length - 1].time);
  if (!firstDataDate || !lastDataDate) return null;

  const fromDate = from ? parseIsoDay(from) : null;
  const tillDate = till ? parseIsoDay(till) : null;
  const start = fromDate ?? firstDataDate;
  const end = tillDate ?? lastDataDate;

  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }
  return { start: end, end: start };
};

const densifyLineData = (
  data: PriceLinePoint[],
  from?: string,
  till?: string
): Array<PriceLinePoint | WhitespacePoint> => {
  if (data.length === 0) return data;

  const byDate = new Map(data.map(point => [point.time, point] as const));
  const bounds = resolveBounds(data, from, till);
  if (!bounds) return data;

  const result: Array<PriceLinePoint | WhitespacePoint> = [];
  let lastClose: number | null = null;
  for (const date of dailySteps(bounds.start, bounds.end)) {
    const point = byDate.get(date);
    if (point) {
      result.push(point);
      lastClose = point.value;
      continue;
    }
    if (lastClose === null) {
      result.push({ time: date });
      continue;
    }
    result.push({ time: date, value: lastClose });
  }
  return result;
};

const densifyCandlestickData = (
  data: PriceCandlestickPoint[],
  from?: string,
  till?: string
): Array<PriceCandlestickPoint | WhitespacePoint> => {
  if (data.length === 0) return data;

  const byDate = new Map(data.map(point => [point.time, point] as const));
  const bounds = resolveBounds(data, from, till);
  if (!bounds) return data;

  const result: Array<PriceCandlestickPoint | WhitespacePoint> = [];
  let lastClose: number | null = null;
  for (const date of dailySteps(bounds.start, bounds.end)) {
    const point = byDate.get(date);
    if (point) {
      result.push(point);
      lastClose = point.close;
      continue;
    }
    if (lastClose === null) {
      result.push({ time: date });
      continue;
    }
    result.push({
      time: date,
      open: lastClose,
      high: lastClose,
      low: lastClose,
      close: lastClose,
    });
  }
  return result;
};

function PriceChart({
  series,
  visibleRange,
}: {
  series: PriceVisualizationSeries[];
  visibleRange?: {
    from?: string;
    till?: string;
  };
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ChartSeriesApi[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getSize = () => ({
      width: container.clientWidth || 0,
      height: Math.max(container.clientHeight || 0, MIN_CHART_HEIGHT),
    });

    const size = getSize();
    const chart = createChart(container, {
      width: size.width,
      height: size.height,
      layout: {
        textColor: '#64748b',
        background: { type: ColorType.Solid, color: 'transparent' },
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.2)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.2)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: {
        vertLine: { color: 'rgba(148, 163, 184, 0.5)' },
        horzLine: { color: 'rgba(148, 163, 184, 0.5)' },
      },
    });

    chartRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      const nextSize = getSize();
      if (nextSize.width === 0 || nextSize.height === 0) return;
      chart.applyOptions(nextSize);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = [];
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const visibleFrom = visibleRange?.from;
    const visibleTill = visibleRange?.till;

    for (const seriesApi of seriesRefs.current) {
      chart.removeSeries(seriesApi);
    }
    seriesRefs.current = [];

    for (let index = 0; index < series.length; index += 1) {
      const entry = series[index];

      if (entry.type === 'candlestick') {
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          ...DEFAULT_CANDLESTICK_OPTIONS,
          ...entry.options,
        });
        candlestickSeries.setData(
          densifyCandlestickData(entry.data, visibleFrom, visibleTill)
        );
        seriesRefs.current.push(candlestickSeries);
        continue;
      }

      const lineSeries = chart.addSeries(LineSeries, {
        ...DEFAULT_LINE_OPTIONS,
        color: entry.options?.color ?? DEFAULT_LINE_COLORS[index % DEFAULT_LINE_COLORS.length],
        ...entry.options,
      });
      lineSeries.setData(densifyLineData(entry.data, visibleFrom, visibleTill));
      seriesRefs.current.push(lineSeries);
    }

    const hasData = series.some(entry => entry.data.length > 0);
    if (!hasData) {
      return;
    }

    chart.timeScale().fitContent();
  }, [series, visibleRange?.from, visibleRange?.till]);

  return <div ref={containerRef} className='h-full w-full' />;
}

export function PriceVisualization(props: PriceVisualizationProps) {
  const {
    loading,
    hasError = false,
    errorMessage,
    noDataMessage,
    series,
    visibleRange,
    className,
    skeletonClassName,
  } = props;

  const hasData = series.some(entry => entry.data.length > 0);
  const showSkeleton = loading && !hasData;

  return (
    <div className={cn(className)}>
      {showSkeleton && (
        <Skeleton
          className={cn('h-full min-h-[200px] w-full', skeletonClassName)}
        />
      )}
      {!loading && hasError && errorMessage && (
        <div className='text-sm text-muted-foreground'>{errorMessage}</div>
      )}
      {!loading && !hasError && !hasData && (
        <div className='text-sm text-muted-foreground'>{noDataMessage}</div>
      )}
      {!showSkeleton && !hasError && hasData && (
        <PriceChart series={series} visibleRange={visibleRange} />
      )}
    </div>
  );
}
