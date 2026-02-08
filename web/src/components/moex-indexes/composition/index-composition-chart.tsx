'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { CompositionSeries } from './use-moex-indexes-composition';

const BASE_SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export const resolveCompositionSeriesColor = (index: number) => {
  if (index < BASE_SERIES_COLORS.length) {
    return BASE_SERIES_COLORS[index];
  }
  const hue = (index * 137.508) % 360;
  const saturation = 62;
  const lightness = index % 2 === 0 ? 46 : 58;
  return `hsl(${Math.round(hue)} ${saturation}% ${lightness}%)`;
};

type IndexCompositionChartProps = {
  series: CompositionSeries[];
  variant?: 'line' | 'stacked';
  highlightedId?: string | null;
};

export function IndexCompositionChart({
  series,
  variant = 'line',
  highlightedId,
}: IndexCompositionChartProps) {
  const seriesMeta = useMemo(
    () =>
      series.map((item, index) => ({
        key: `series_${index}`,
        id: item.id,
        name: item.name,
        color: resolveCompositionSeriesColor(index),
      })),
    [series]
  );

  const chartConfig = useMemo<ChartConfig>(() => {
    return seriesMeta.reduce<ChartConfig>((acc, item) => {
      acc[item.key] = {
        label: item.id,
        color: item.color,
      };
      return acc;
    }, {});
  }, [seriesMeta]);

  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, number | string>>();
    seriesMeta.forEach((meta, index) => {
      const item = series[index];
      item?.data.forEach((point) => {
        const row = rows.get(point.time) ?? { time: point.time };
        row[meta.key] = point.value;
        rows.set(point.time, row);
      });
    });
    return Array.from(rows.values()).sort((a, b) =>
      String(a.time).localeCompare(String(b.time))
    );
  }, [series, seriesMeta]);

  const highlightedKey = useMemo(() => {
    if (!highlightedId) return null;
    return seriesMeta.find((item) => item.id === highlightedId)?.key ?? null;
  }, [highlightedId, seriesMeta]);

  const hasHighlight = Boolean(highlightedKey);

  return (
    <ChartContainer config={chartConfig} className='min-h-[200px] h-full w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        {variant === 'stacked' ? (
          <AreaChart data={chartData} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey='time' tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip
              content={
                <ChartTooltipContent labelKey='time' indicator='line' />
              }
            />
            {seriesMeta.map((item) => {
              const isDimmed = hasHighlight && item.key !== highlightedKey;
              return (
                <Area
                  key={item.key}
                  dataKey={item.key}
                  type='monotone'
                  stackId='composition'
                  stroke={`var(--color-${item.key})`}
                  fill={`var(--color-${item.key})`}
                  fillOpacity={isDimmed ? 0.08 : 0.35}
                  strokeOpacity={isDimmed ? 0.2 : 0.9}
                  strokeWidth={isDimmed ? 1 : 1.5}
                  isAnimationActive={false}
                />
              );
            })}
          </AreaChart>
        ) : (
          <LineChart data={chartData} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey='time' tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip
              content={
                <ChartTooltipContent labelKey='time' indicator='line' />
              }
            />
            {seriesMeta.map((item) => {
              const isDimmed = hasHighlight && item.key !== highlightedKey;
              return (
                <Line
                  key={item.key}
                  dataKey={item.key}
                  type='monotone'
                  stroke={`var(--color-${item.key})`}
                  strokeOpacity={isDimmed ? 0.2 : 0.9}
                  strokeWidth={isDimmed ? 1.25 : 2}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartContainer>
  );
}
