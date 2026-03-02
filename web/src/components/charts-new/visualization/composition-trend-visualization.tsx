'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CompositionSeries } from './chart-types';
import { resolveCompositionSeriesColor } from './composition-colors';

type CompositionTrendVisualizationProps = {
  loading: boolean;
  hasError: boolean;
  errorMessage: string;
  noDataMessage: string;
  series: CompositionSeries[];
  className?: string;
  chartClassName?: string;
  skeletonClassName?: string;
};

const TOOLTIP_MIN_VALUE = 0.0001;

export function CompositionTrendVisualization({
  loading,
  hasError,
  errorMessage,
  noDataMessage,
  series,
  className,
  chartClassName,
  skeletonClassName,
}: CompositionTrendVisualizationProps) {
  const showSkeleton = loading && series.length === 0;
  const seriesMeta = useMemo(
    () =>
      series.map((item, index) => ({
        key: `series_${index}`,
        id: item.id,
        color: resolveCompositionSeriesColor(index),
      })),
    [series]
  );

  const chartData = useMemo(() => {
    const rows = new Map<string, Record<string, number | string>>();
    seriesMeta.forEach((meta, index) => {
      const item = series[index];
      item?.data.forEach(point => {
        const row = rows.get(point.time) ?? { time: point.time };
        row[meta.key] = point.value;
        rows.set(point.time, row);
      });
    });

    return Array.from(rows.values()).sort((a, b) =>
      String(a.time).localeCompare(String(b.time))
    );
  }, [series, seriesMeta]);

  const chartConfig = useMemo<ChartConfig>(() => {
    return seriesMeta.reduce<ChartConfig>((acc, item) => {
      acc[item.key] = {
        label: item.id,
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
        valueFormatter={value => `${value.toFixed(2)}%`}
      />
    );
  };

  return (
    <div className={cn(className)}>
      {showSkeleton && (
        <Skeleton
          className={cn('h-full min-h-[200px] w-full', skeletonClassName)}
        />
      )}
      {!loading && hasError && (
        <div className='text-sm text-muted-foreground'>{errorMessage}</div>
      )}
      {!loading && !hasError && series.length === 0 && (
        <div className='text-sm text-muted-foreground'>{noDataMessage}</div>
      )}
      {!showSkeleton && !hasError && series.length > 0 && (
        <div className={cn('h-full min-h-[200px] w-full', chartClassName)}>
          <ChartContainer
            config={chartConfig}
            className='min-h-[200px] h-full w-full'
          >
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart
                data={chartData}
                margin={{ left: 4, right: 4 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey='time' tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={36} />
                <Tooltip content={renderTooltipContent} />
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
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
