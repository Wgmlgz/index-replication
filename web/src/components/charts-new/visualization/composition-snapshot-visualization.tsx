'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  Treemap,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CompositionSnapshotItem } from './chart-types';
import { resolveCompositionSeriesColor } from './composition-colors';

type TreemapNode = {
  name: string;
  ticker: string;
  value: number;
  fill: string;
};

const TreemapTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const node = payload[0]?.payload as TreemapNode | undefined;
  if (!node) return null;

  return (
    <div className='grid gap-1 rounded-lg border bg-background p-2 text-xs shadow-sm'>
      <div className='text-[11px] text-muted-foreground'>{node.ticker}</div>
      <div className='font-medium text-foreground'>{node.name}</div>
      <div className='text-xs text-muted-foreground'>{node.value.toFixed(2)}%</div>
    </div>
  );
};

type TreemapContentProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  fill?: string;
  ticker?: string;
  value?: number;
};

const TreemapContent = (props: TreemapContentProps) => {
  const { x, y, width, height, fill, name, ticker, value } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return null;
  }

  const canShowLabel = width > 80 && height > 24;
  const label = ticker ?? '';
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill ?? 'transparent'} />
      {canShowLabel && (
        <>
          <text
            x={x + 8}
            y={y + 16}
            fill='rgba(255,255,255,0.9)'
            fontSize={11}
            fontWeight={600}
          >
            {label}
          </text>
          <text x={x + 8} y={y + 30} fill='rgba(255,255,255,0.7)' fontSize={10}>
            {name ?? ''}
          </text>
          <text x={x + 8} y={y + 44} fill='rgba(255,255,255,0.8)' fontSize={10}>
            {(value ?? 0).toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
};

type CompositionSnapshotVisualizationProps = {
  loading: boolean;
  hasError: boolean;
  errorMessage: string;
  noDataMessage: string;
  items: CompositionSnapshotItem[];
  className?: string;
  chartClassName?: string;
  skeletonClassName?: string;
};

export function CompositionSnapshotVisualization({
  loading,
  hasError,
  errorMessage,
  noDataMessage,
  items,
  className,
  chartClassName,
  skeletonClassName,
}: CompositionSnapshotVisualizationProps) {
  const showSkeleton = loading && items.length === 0;
  const data = useMemo<TreemapNode[]>(
    () =>
      items.map((item, index) => ({
        name: item.name || item.ticker,
        ticker: item.ticker,
        value: item.weight,
        fill: resolveCompositionSeriesColor(index),
      })),
    [items]
  );

  return (
    <div className={cn(className)}>
      {showSkeleton && (
        <Skeleton
          className={cn('h-full min-h-[240px] w-full', skeletonClassName)}
        />
      )}
      {!loading && hasError && (
        <div className='text-sm text-muted-foreground'>{errorMessage}</div>
      )}
      {!loading && !hasError && items.length === 0 && (
        <div className='text-sm text-muted-foreground'>{noDataMessage}</div>
      )}
      {!showSkeleton && !hasError && items.length > 0 && (
        <div className={cn('h-full min-h-[240px] w-full', chartClassName)}>
          <ResponsiveContainer width='100%' height='100%'>
            <Treemap
              data={data}
              dataKey='value'
              stroke='var(--border)'
              content={<TreemapContent />}
              isAnimationActive={false}
            >
              <Tooltip content={<TreemapTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
