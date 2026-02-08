'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  AreaSeries,
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
  variant?: 'line' | 'stacked';
};

type SeriesApi = ISeriesApi<'Line'> | ISeriesApi<'Area'>;

const buildStackedSeries = (
  input: Array<CompositionSeries & { color: string }>
) => {
  const times = new Set<string>();
  const maps = input.map((item) => {
    const map = new Map<string, number>();
    item.data.forEach((point) => {
      if (point.time) {
        map.set(point.time, point.value);
        times.add(point.time);
      }
    });
    return map;
  });

  const orderedTimes = Array.from(times).sort();
  const stacked = input.map((item) => ({
    ...item,
    data: [] as Array<{ time: string; value: number }>,
  }));

  orderedTimes.forEach((time) => {
    let cumulative = 0;
    maps.forEach((map, index) => {
      const value = map.get(time) ?? 0;
      cumulative += value;
      stacked[index].data.push({ time, value: cumulative });
    });
  });

  return stacked;
};

export function IndexCompositionChart({
  series,
  variant = 'line',
}: IndexCompositionChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesMapRef = useRef<Map<string, SeriesApi>>(new Map());
  const variantRef = useRef<'line' | 'stacked' | null>(null);

  const seriesWithColors = useMemo(
    () =>
      series.map((item, index) => ({
        ...item,
        color: COMPOSITION_SERIES_COLORS[index % COMPOSITION_SERIES_COLORS.length],
      })),
    [series]
  );
  const displaySeries = useMemo(() => {
    if (variant === 'stacked') {
      return buildStackedSeries(seriesWithColors);
    }
    return seriesWithColors;
  }, [seriesWithColors, variant]);

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
    const activeIds = new Set(displaySeries.map((item) => item.id));

    if (variantRef.current !== variant) {
      Array.from(seriesMap.values()).forEach((api) => chart.removeSeries(api));
      seriesMap.clear();
      variantRef.current = variant;
    }

    Array.from(seriesMap.entries()).forEach(([id, api]) => {
      if (!activeIds.has(id)) {
        chart.removeSeries(api);
        seriesMap.delete(id);
      }
    });

    displaySeries.forEach((item) => {
      let seriesApi = seriesMap.get(item.id);
      if (!seriesApi) {
        if (variant === 'stacked') {
          seriesApi = chart.addSeries(AreaSeries, {
            lineColor: item.color,
            topColor: `${item.color}80`,
            bottomColor: `${item.color}10`,
            lineWidth: 1,
          });
        } else {
          seriesApi = chart.addSeries(LineSeries, {
            color: item.color,
            lineWidth: 2,
          });
        }
        seriesMap.set(item.id, seriesApi);
      }
      seriesApi.setData(item.data);
    });

    if (displaySeries.length > 0) {
      chart.timeScale().fitContent();
    }
  }, [displaySeries, variant]);

  return <div ref={containerRef} className='h-full w-full' />;
}
