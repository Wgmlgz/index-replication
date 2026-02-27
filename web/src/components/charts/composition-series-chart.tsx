'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type CompositionSeries = {
  id: string;
  name: string;
  data: Array<{ time: string; value: number }>;
};

const BASE_SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export const OTHER_SERIES_COLOR = 'var(--muted-foreground)';

export const resolveCompositionSeriesColor = (index: number) => {
  if (index < BASE_SERIES_COLORS.length) {
    return BASE_SERIES_COLORS[index];
  }
  const hue = (index * 137.508) % 360;
  const saturation = 62;
  const lightness = index % 2 === 0 ? 46 : 58;
  return `hsl(${Math.round(hue)} ${saturation}% ${lightness}%)`;
};

const formatPercentTooltipValue = (value: number) => `${value.toFixed(2)}%`;
const TOOLTIP_MIN_VALUE = 0.0001;

type CompositionSeriesChartProps = {
  series: CompositionSeries[];
  variant?: 'line' | 'stacked';
  includeOther?: boolean;
};

export function CompositionSeriesChart({
  series,
  variant = 'line',
  includeOther = false,
}: CompositionSeriesChartProps) {
  const baseSeriesMeta = useMemo(
    () =>
      series.map((item, index) => ({
        key: `series_${index}`,
        id: item.id,
        color: resolveCompositionSeriesColor(index),
      })),
    [series],
  );

  const { chartData, seriesMeta } = useMemo(() => {
    const rows = new Map<string, Record<string, number | string>>();
    baseSeriesMeta.forEach((meta, index) => {
      const item = series[index];
      item?.data.forEach(point => {
        const row = rows.get(point.time) ?? { time: point.time };
        row[meta.key] = point.value;
        rows.set(point.time, row);
      });
    });

    const data = Array.from(rows.values()).sort((a, b) =>
      String(a.time).localeCompare(String(b.time)),
    );
    const fillMissing = variant === 'stacked';
    if (fillMissing) {
      data.forEach(row => {
        baseSeriesMeta.forEach(meta => {
          if (typeof row[meta.key] !== 'number') {
            row[meta.key] = 0;
          }
        });
      });
    }

    if (!includeOther) {
      return { chartData: data, seriesMeta: baseSeriesMeta };
    }

    const otherKey = 'series_other';
    let hasOther = false;
    data.forEach(row => {
      const sum = baseSeriesMeta.reduce((total, meta) => {
        const value =
          typeof row[meta.key] === 'number' ? (row[meta.key] as number) : 0;
        return total + value;
      }, 0);
      const otherValue = Number(Math.max(0, 100 - sum).toFixed(2));
      if (otherValue > 0.01) {
        row[otherKey] = otherValue;
        hasOther = true;
      } else {
        row[otherKey] = 0;
      }
    });

    if (!hasOther) {
      data.forEach(row => {
        delete row[otherKey];
      });
      return { chartData: data, seriesMeta: baseSeriesMeta };
    }

    return {
      chartData: data,
      seriesMeta: [
        ...baseSeriesMeta,
        { key: otherKey, id: 'OTHER', color: OTHER_SERIES_COLOR },
      ],
    };
  }, [baseSeriesMeta, includeOther, series, variant]);

  const chartConfig = useMemo<ChartConfig>(() => {
    return seriesMeta.reduce<ChartConfig>((acc, item) => {
      acc[item.key] = {
        label: item.id === 'OTHER' ? 'Other' : item.id,
        color: item.color,
      };
      return acc;
    }, {});
  }, [seriesMeta]);

  const renderTooltipContent = (props: TooltipProps<number, string>) => {
    const filteredPayload = (props.payload ?? [])
      .filter(
        item =>
          typeof item.value === 'number' &&
          Math.abs(item.value) >= TOOLTIP_MIN_VALUE
      )
      .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

    return (
      <ChartTooltipContent
        {...props}
        payload={filteredPayload}
        valueFormatter={(value) => formatPercentTooltipValue(value)}
      />
    );
  };

  return (
    <ChartContainer
      config={chartConfig}
      className='min-h-[200px] h-full w-full'
    >
      <ResponsiveContainer width='100%' height='100%'>
        {variant === 'stacked' ? (
          <AreaChart
            data={chartData}
            margin={{ left: 4, right: 4 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey='time' tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, 100]}
              tickFormatter={(value: number) => `${Math.round(value)}%`}
            />
            <Tooltip
              content={renderTooltipContent}
            />
            {seriesMeta.map(item => (
              <Area
                key={item.key}
                dataKey={item.key}
                type='monotone'
                stackId='composition'
                stroke={`var(--color-${item.key})`}
                fill={`var(--color-${item.key})`}
                fillOpacity={0.35}
                strokeOpacity={0.9}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart
            data={chartData}
            margin={{ left: 4, right: 4 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey='time' tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <Tooltip
              content={renderTooltipContent}
            />
            {seriesMeta.map(item => (
              <Line
                key={item.key}
                dataKey={item.key}
                type='monotone'
                stroke={`var(--color-${item.key})`}
                strokeOpacity={0.9}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </ChartContainer>
  );
}

export const IndexCompositionChart = CompositionSeriesChart;
