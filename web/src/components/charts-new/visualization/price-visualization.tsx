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
  PriceCandlestickSeriesOptions,
  PriceLineSeriesOptions,
  PriceVisualizationSeries,
} from './chart-types';

type PriceVisualizationProps = {
  loading: boolean;
  hasError?: boolean;
  errorMessage?: string;
  noDataMessage: string;
  series: PriceVisualizationSeries[];
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

function PriceChart({
  series,
}: {
  series: PriceVisualizationSeries[];
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
        candlestickSeries.setData(entry.data);
        seriesRefs.current.push(candlestickSeries);
        continue;
      }

      const lineSeries = chart.addSeries(LineSeries, {
        ...DEFAULT_LINE_OPTIONS,
        color: entry.options?.color ?? DEFAULT_LINE_COLORS[index % DEFAULT_LINE_COLORS.length],
        ...entry.options,
      });
      lineSeries.setData(entry.data);
      seriesRefs.current.push(lineSeries);
    }

    if (series.some(entry => entry.data.length > 0)) {
      chart.timeScale().fitContent();
    }
  }, [series]);

  return <div ref={containerRef} className='h-full w-full' />;
}

export function PriceVisualization(props: PriceVisualizationProps) {
  const {
    loading,
    hasError = false,
    errorMessage,
    noDataMessage,
    series,
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
        <PriceChart series={series} />
      )}
    </div>
  );
}
