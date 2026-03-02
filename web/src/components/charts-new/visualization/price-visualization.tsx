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
  PriceChartData,
  PriceCandlestickPoint,
  PriceLinePoint,
  PriceSeriesType,
} from './chart-types';

type PriceVisualizationProps = {
  loading: boolean;
  hasError?: boolean;
  errorMessage?: string;
  noDataMessage: string;
  data: PriceChartData;
  seriesType: PriceSeriesType;
  className?: string;
  skeletonClassName?: string;
};

const MIN_CHART_HEIGHT = 200;

function PriceChart({
  data,
  seriesType,
}: {
  data: PriceChartData;
  seriesType: PriceSeriesType;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Candlestick'> | null>(
    null
  );
  const seriesTypeRef = useRef<PriceSeriesType | null>(null);

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
      seriesRef.current = null;
      seriesTypeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (seriesTypeRef.current !== seriesType) {
      if (seriesRef.current) {
        chart.removeSeries(seriesRef.current as ISeriesApi<'Line'>);
        seriesRef.current = null;
      }

      seriesRef.current =
        seriesType === 'candlestick'
          ? chart.addSeries(CandlestickSeries, {
              upColor: '#16a34a',
              downColor: '#dc2626',
              wickUpColor: '#16a34a',
              wickDownColor: '#dc2626',
              borderVisible: false,
            })
          : chart.addSeries(LineSeries, {
              color: '#2563eb',
              lineWidth: 2,
            });
      seriesTypeRef.current = seriesType;
    }
  }, [seriesType]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (seriesType === 'candlestick') {
      (seriesRef.current as ISeriesApi<'Candlestick'>).setData(
        data as PriceCandlestickPoint[]
      );
    } else {
      (seriesRef.current as ISeriesApi<'Line'>).setData(data as PriceLinePoint[]);
    }
    if (data.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, seriesType]);

  return <div ref={containerRef} className='h-full w-full' />;
}

export function PriceVisualization({
  loading,
  hasError = false,
  errorMessage,
  noDataMessage,
  data,
  seriesType,
  className,
  skeletonClassName,
}: PriceVisualizationProps) {
  const showSkeleton = loading && data.length === 0;

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
      {!loading && !hasError && data.length === 0 && (
        <div className='text-sm text-muted-foreground'>{noDataMessage}</div>
      )}
      {!showSkeleton && !hasError && data.length > 0 && (
        <PriceChart data={data} seriesType={seriesType} />
      )}
    </div>
  );
}
