'use client';

import { useMemo, useState } from 'react';
import { format, subWeeks } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type {
  CompositionSeries,
  CompositionSnapshotItem,
} from '@/components/moex-indexes/composition/use-moex-indexes-composition';

const SERIES_COUNTS = [5, 10, 15, 25, 40];

const createRng = (seed: number) => {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildSampleSeries = (count: number): CompositionSeries[] => {
  const rng = createRng(42);
  const weeks = 30;
  const dates = Array.from({ length: weeks }, (_, index) =>
    format(subWeeks(new Date(), weeks - 1 - index), 'yyyy-MM-dd')
  );

  const bases = Array.from({ length: count }, () => 1 + rng() * 6);

  return Array.from({ length: count }, (_, seriesIndex) => {
    const data = dates.map((date, i) => {
      const jitter = 0.7 + rng() * 0.6;
      return { time: date, value: bases[seriesIndex] * jitter };
    });

    return {
      id: `S${String(seriesIndex + 1).padStart(2, '0')}`,
      name: `Sample ${seriesIndex + 1}`,
      data,
    };
  });
};

const normalizeSeriesToTarget = (series: CompositionSeries[]) => {
  if (series.length === 0) return series;
  const points = series[0].data.length;
  const rng = createRng(7);
  const targets = Array.from({ length: points }, () => 70 + rng() * 20);

  const updated = series.map((item) => ({
    ...item,
    data: [...item.data],
  }));

  for (let i = 0; i < points; i += 1) {
    const sum = updated.reduce((total, item) => total + (item.data[i]?.value ?? 0), 0);
    const target = targets[i] ?? 80;
    const scale = sum > 0 ? target / sum : 1;
    updated.forEach((item) => {
      const value = item.data[i]?.value ?? 0;
      item.data[i] = {
        time: item.data[i]?.time ?? '',
        value: Number((value * scale).toFixed(2)),
      };
    });
  }

  return updated;
};

const BASE_SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const resolveColor = (index: number) => {
  if (index < BASE_SERIES_COLORS.length) return BASE_SERIES_COLORS[index];
  const hue = (index * 137.508) % 360;
  return `hsl(${Math.round(hue)} 62% 52%)`;
};

type DemoSeriesMeta = {
  key: string;
  label: string;
  color: string;
};

const buildChartData = (series: CompositionSeries[], includeOther: boolean) => {
  const meta: DemoSeriesMeta[] = series.map((item, index) => ({
    key: `series_${index}`,
    label: item.id,
    color: resolveColor(index),
  }));

  const rows = new Map<string, Record<string, number | string>>();
  series.forEach((item, index) => {
    const key = meta[index]?.key;
    if (!key) return;
    item.data.forEach((point) => {
      const row = rows.get(point.time) ?? { time: point.time };
      row[key] = point.value;
      rows.set(point.time, row);
    });
  });

  const data = Array.from(rows.values()).sort((a, b) =>
    String(a.time).localeCompare(String(b.time))
  );

  if (!includeOther) return { data, meta };

  const otherKey = 'series_other';
  let hasOther = false;
  data.forEach((row) => {
    const sum = meta.reduce((total, entry) => {
      const value = typeof row[entry.key] === 'number' ? (row[entry.key] as number) : 0;
      return total + value;
    }, 0);
    const otherValue = Math.max(0, 100 - sum);
    if (otherValue > 0.01) {
      row[otherKey] = otherValue;
      hasOther = true;
    } else {
      row[otherKey] = 0;
    }
  });

  if (!hasOther) return { data, meta };

  return {
    data,
    meta: [
      ...meta,
      { key: otherKey, label: 'Other', color: 'var(--muted-foreground)' },
    ],
  };
};

const buildTreemapData = (items: CompositionSnapshotItem[]) => {
  return items.map((item, index) => ({
    name: item.name || item.ticker,
    ticker: item.ticker,
    value: item.weight,
    fill: resolveColor(index),
  }));
};

const TreemapTooltip = ({
  active,
  payload,
}: TooltipProps<number, string>) => {
  if (!active || !payload?.length) return null;
  const node = payload[0]?.payload as { name?: string; ticker?: string; value?: number } | undefined;
  if (!node) return null;
  return (
    <div className='grid gap-1 rounded-lg border bg-background p-2 text-xs shadow-sm'>
      <div className='text-[11px] text-muted-foreground'>{node.ticker}</div>
      <div className='font-medium text-foreground'>{node.name}</div>
      <div className='text-xs text-muted-foreground'>
        {(node.value ?? 0).toFixed(2)}%
      </div>
    </div>
  );
};

const renderTreemapCell = (props: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  ticker: string;
  value: number;
  fill: string;
}) => {
  const { x, y, width, height, fill, name, ticker, value } = props;
  const canShowLabel = width > 80 && height > 24;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      {canShowLabel && (
        <>
          <text
            x={x + 8}
            y={y + 16}
            fill='rgba(255,255,255,0.9)'
            fontSize={11}
            fontWeight={600}
          >
            {ticker}
          </text>
          <text
            x={x + 8}
            y={y + 30}
            fill='rgba(255,255,255,0.7)'
            fontSize={10}
          >
            {name}
          </text>
          <text
            x={x + 8}
            y={y + 44}
            fill='rgba(255,255,255,0.8)'
            fontSize={10}
          >
            {value.toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
};

export default function MoexCompositionDemoPage() {
  const { t } = useTranslation();
  const [seriesCount, setSeriesCount] = useState<number>(15);
  const [variant, setVariant] = useState<'line' | 'stacked'>('stacked');

  const series = useMemo(() => {
    const base = buildSampleSeries(seriesCount);
    return normalizeSeriesToTarget(base);
  }, [seriesCount]);

  const { data: chartData, meta: seriesMeta } = useMemo(
    () => buildChartData(series, variant === 'stacked'),
    [series, variant]
  );

  const snapshotItems = useMemo<CompositionSnapshotItem[]>(() => {
    const latestIndex = series[0]?.data.length
      ? series[0].data.length - 1
      : 0;
    return series.map((item) => ({
      ticker: item.id,
      name: item.name,
      weight: item.data[latestIndex]?.value ?? 0,
      tradeDate: item.data[latestIndex]?.time ?? '',
    }));
  }, [series]);

  const treemapData = useMemo(
    () => buildTreemapData(snapshotItems),
    [snapshotItems]
  );

  return (
    <div className='flex min-h-[calc(100svh-65px-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] flex-col gap-6 overflow-hidden'>
      <div>
        <h1 className='text-3xl font-bold'>{t('moex.demo.title')}</h1>
        <p className='mt-2 text-muted-foreground'>{t('moex.demo.description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('moex.demo.controls')}</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-3'>
          <div className='flex flex-col gap-1'>
            <span className='text-xs text-muted-foreground'>
              {t('moex.demo.seriesCount')}
            </span>
            <Select
              value={String(seriesCount)}
              onValueChange={(value) => setSeriesCount(Number(value))}
            >
              <SelectTrigger size='sm' className='h-8 text-xs'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERIES_COUNTS.map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <span className='text-xs text-muted-foreground'>
              {t('moex.demo.variant')}
            </span>
            <Select
              value={variant}
              onValueChange={(value) => setVariant(value as 'line' | 'stacked')}
            >
              <SelectTrigger size='sm' className='h-8 text-xs'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='stacked'>
                  {t('moex.demo.variantStacked')}
                </SelectItem>
                <SelectItem value='line'>
                  {t('moex.demo.variantLine')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className='grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]'>
        <Card className='flex min-h-0 flex-col'>
          <CardHeader>
            <CardTitle>{t('moex.demo.snapshot')}</CardTitle>
          </CardHeader>
          <CardContent className='flex min-h-[240px] flex-1'>
            <div className='h-full w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                <Treemap
                  data={treemapData}
                  dataKey='value'
                  stroke='var(--border)'
                  content={renderTreemapCell}
                  isAnimationActive={false}
                >
                  <Tooltip content={<TreemapTooltip />} />
                </Treemap>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className='flex min-h-0 flex-col'>
          <CardHeader>
            <CardTitle>{t('moex.demo.series')}</CardTitle>
          </CardHeader>
          <CardContent className='flex min-h-[240px] flex-1'>
            <div className='h-full w-full'>
              <ResponsiveContainer width='100%' height='100%'>
                {variant === 'stacked' ? (
                  <AreaChart data={chartData} margin={{ left: 4, right: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey='time' tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      domain={[0, 100]}
                      tickFormatter={(value: number) => `${Math.round(value)}%`}
                    />
                    <Tooltip />
                    {seriesMeta.map((item) => (
                      <Area
                        key={item.key}
                        dataKey={item.key}
                        type='monotone'
                        stackId='composition'
                        stroke={item.color}
                        fill={item.color}
                        fillOpacity={0.35}
                        strokeOpacity={0.9}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                ) : (
                  <LineChart data={chartData} margin={{ left: 4, right: 4 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey='time' tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <Tooltip />
                    {seriesMeta.map((item) => (
                      <Line
                        key={item.key}
                        dataKey={item.key}
                        type='monotone'
                        stroke={item.color}
                        strokeOpacity={0.9}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
