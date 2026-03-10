'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  Treemap,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TICKER_LOGO_CACHE_MS,
  normalizeTicker,
  resolveTickerLogoUrl,
  tickerLogoQueryKey,
} from '@/lib/ticker-logo';
import { cn } from '@/lib/utils';
import type { CompositionSnapshotItem } from './chart-types';
import { resolveCompositionSeriesColor } from './composition-colors';

type TreemapNode = {
  name: string;
  ticker: string;
  value: number;
  fill: string;
};

type TreemapTooltipProps = TooltipProps<number, string> & {
  logoByTicker: Record<string, string | null>;
};

const TreemapTooltip = ({ active, payload, logoByTicker }: TreemapTooltipProps) => {
  if (!active || !payload?.length) return null;
  const node = payload[0]?.payload as TreemapNode | undefined;
  if (!node) return null;
  const logoUrl = logoByTicker[normalizeTicker(node.ticker)] ?? null;

  return (
    <div className='grid gap-1 rounded-lg border bg-background p-2 text-xs shadow-sm'>
      <div className='flex items-center gap-2'>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=''
            aria-hidden='true'
            className='size-4 shrink-0 rounded-[4px] object-contain'
            loading='lazy'
            decoding='async'
            referrerPolicy='no-referrer'
          />
        ) : (
          <span
            aria-hidden='true'
            className='inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted text-[10px] font-semibold uppercase text-muted-foreground'
          >
            {node.ticker.charAt(0)}
          </span>
        )}
        <div className='text-[11px] text-muted-foreground'>{node.ticker}</div>
      </div>
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
  logoByTicker: Record<string, string | null>;
};

const TreemapContent = (props: TreemapContentProps) => {
  const { x, y, width, height, fill, name, ticker, value, logoByTicker } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return null;
  }

  const canShowLabel = width > 80 && height > 24;
  const label = ticker ?? '';
  const logoUrl = logoByTicker[normalizeTicker(label)] ?? null;
  const labelOffsetX = x + 26;
  const labelInitial = label.charAt(0).toUpperCase();
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill ?? 'transparent'} />
      {canShowLabel && (
        <>
          <rect
            x={x + 8}
            y={y + 4}
            width={14}
            height={14}
            rx={3}
            ry={3}
            fill='rgba(255,255,255,0.2)'
          />
          {logoUrl && (
            <image
              href={logoUrl}
              x={x + 8}
              y={y + 4}
              width={14}
              height={14}
              preserveAspectRatio='xMidYMid meet'
            />
          )}
          {!logoUrl && (
            <text
              x={x + 15}
              y={y + 14}
              fill='rgba(255,255,255,0.9)'
              fontSize={8}
              fontWeight={700}
              textAnchor='middle'
            >
              {labelInitial}
            </text>
          )}
          <text
            x={labelOffsetX}
            y={y + 16}
            fill='rgba(255,255,255,0.9)'
            fontSize={11}
            fontWeight={600}
          >
            {label}
          </text>
          <text x={labelOffsetX} y={y + 30} fill='rgba(255,255,255,0.7)' fontSize={10}>
            {name ?? ''}
          </text>
          <text x={labelOffsetX} y={y + 44} fill='rgba(255,255,255,0.8)' fontSize={10}>
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
  const uniqueTickers = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map(item => normalizeTicker(item.ticker))
            .filter(Boolean),
        ),
      ),
    [items],
  );
  const logoQueries = useQueries({
    queries: uniqueTickers.map(ticker => ({
      queryKey: tickerLogoQueryKey(ticker),
      queryFn: () => resolveTickerLogoUrl(ticker),
      enabled: ticker.length > 0,
      staleTime: TICKER_LOGO_CACHE_MS,
      gcTime: TICKER_LOGO_CACHE_MS,
      retry: 1,
      refetchOnWindowFocus: false,
    })),
  });
  const logoByTicker = useMemo<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {};
    uniqueTickers.forEach((ticker, index) => {
      const logoUrl = logoQueries[index]?.data;
      map[ticker] = typeof logoUrl === 'string' ? logoUrl : null;
    });
    return map;
  }, [logoQueries, uniqueTickers]);

  const data = useMemo<TreemapNode[]>(
    () =>
      items.map((item, index) => ({
        ticker: normalizeTicker(item.ticker),
        name: item.name || item.ticker,
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
              content={<TreemapContent logoByTicker={logoByTicker} />}
              isAnimationActive={false}
            >
              <Tooltip content={<TreemapTooltip logoByTicker={logoByTicker} />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
