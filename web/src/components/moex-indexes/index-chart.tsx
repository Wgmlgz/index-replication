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

const CHART_HEIGHT = 360;

export type ChartPoint = LineData;

export function IndexChart({ data }: { data: ChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: CHART_HEIGHT,
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
      chart.applyOptions({
        width: container.clientWidth,
        height: CHART_HEIGHT,
      });
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
    <div
      ref={containerRef}
      className='w-full'
      style={{ height: CHART_HEIGHT }}
    />
  );
}
