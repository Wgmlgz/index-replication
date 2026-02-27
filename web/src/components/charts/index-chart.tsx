'use client';

import { useEffect, useRef } from 'react';
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
} from 'lightweight-charts';

const MIN_CHART_HEIGHT = 200;

export type ChartSeriesType = 'line' | 'candlestick';
export type LineChartPoint = LineData;
export type CandlestickChartPoint = CandlestickData;
export type ChartData = LineChartPoint[] | CandlestickChartPoint[];

type IndexChartProps = {
  data: ChartData;
  seriesType: ChartSeriesType;
};

export function IndexChart({ data, seriesType }: IndexChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Candlestick'> | null>(
    null
  );
  const seriesTypeRef = useRef<ChartSeriesType | null>(null);

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
        data as CandlestickChartPoint[]
      );
    } else {
      (seriesRef.current as ISeriesApi<'Line'>).setData(
        data as LineChartPoint[]
      );
    }
    if (data.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, seriesType]);

  return (
    <div ref={containerRef} className='h-full w-full' />
  );
}
