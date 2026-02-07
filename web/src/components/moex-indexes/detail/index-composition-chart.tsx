'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  ColorType,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';
import type { CompositionSeries } from './use-moex-indexes-composition';

const MIN_CHART_HEIGHT = 200;
export const COMPOSITION_SERIES_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#dc2626',
  '#0ea5e9',
  '#a855f7',
  '#14b8a6',
  '#eab308',
  '#f43f5e',
  '#84cc16',
];

type IndexCompositionChartProps = {
  series: CompositionSeries[];
};

export function IndexCompositionChart({ series }: IndexCompositionChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  const seriesWithColors = useMemo(
    () =>
      series.map((item, index) => ({
        ...item,
        color: COMPOSITION_SERIES_COLORS[index % COMPOSITION_SERIES_COLORS.length],
      })),
    [series]
  );

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
      seriesMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const seriesMap = seriesMapRef.current;
    const activeIds = new Set(seriesWithColors.map((item) => item.id));
    Array.from(seriesMap.entries()).forEach(([id, api]) => {
      if (!activeIds.has(id)) {
        chart.removeSeries(api);
        seriesMap.delete(id);
      }
    });

    seriesWithColors.forEach((item) => {
      let seriesApi = seriesMap.get(item.id);
      if (!seriesApi) {
        seriesApi = chart.addSeries(LineSeries, {
          color: item.color,
          lineWidth: 2,
        });
        seriesMap.set(item.id, seriesApi);
      }
      seriesApi.setData(item.data);
    });

    if (seriesWithColors.length > 0) {
      chart.timeScale().fitContent();
    }
  }, [seriesWithColors]);

  return <div ref={containerRef} className='h-full w-full' />;
}
