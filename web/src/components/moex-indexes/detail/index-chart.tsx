'use client';

import { useEffect, useRef } from 'react';
import {
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
} from 'lightweight-charts';

const MIN_CHART_HEIGHT = 240;

export type ChartPoint = LineData;

export function IndexChart({ data }: { data: ChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

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

    const series = chart.addSeries(LineSeries, {
      color: '#2563eb',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

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
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(data);
    if (data.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  return (
    <div ref={containerRef} className='h-full w-full' />
  );
}
