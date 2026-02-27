'use client';

import * as React from 'react';
import {
  Tooltip,
  type TooltipProps,
  Legend,
  type LegendProps,
} from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    color?: string;
    theme?: {
      light: string;
      dark: string;
    };
  }
>;

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

const useChart = () => {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error('useChart must be used within a ChartContainer');
  }
  return context;
};

type ChartContainerProps = React.HTMLAttributes<HTMLDivElement> & {
  config: ChartConfig;
  id?: string;
};

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ChartContainerProps) {
  const autoChartId = React.useId().replace(/:/g, '');
  const chartId = id ?? autoChartId;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          'flex aspect-video justify-center text-xs',
          '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
          '[&_.recharts-cartesian-grid_line]:stroke-border/50',
          '[&_.recharts-layer]:outline-hidden',
          '[&_.recharts-tooltip-cursor]:stroke-border',
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {children}
      </div>
    </ChartContext.Provider>
  );
}

type ChartStyleProps = {
  id: string;
  config: ChartConfig;
};

function ChartStyle({ id, config }: ChartStyleProps) {
  const entries = Object.entries(config);
  if (entries.length === 0) return null;

  const light: string[] = [];
  const dark: string[] = [];

  entries.forEach(([key, value]) => {
    const lightColor = value.color ?? value.theme?.light;
    const darkColor = value.color ?? value.theme?.dark ?? lightColor;
    if (!lightColor) return;
    light.push(`--color-${key}: ${lightColor};`);
    if (darkColor) {
      dark.push(`--color-${key}: ${darkColor};`);
    }
  });

  if (light.length === 0) return null;

  const css = [
    `[data-chart="${id}"] { ${light.join(' ')} }`,
    dark.length > 0 ? `.dark [data-chart="${id}"] { ${dark.join(' ')} }` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export function ChartTooltip(props: TooltipProps<number, string>) {
  return <Tooltip cursor={false} {...props} />;
}

type ChartTooltipContentProps = TooltipProps<number, string> & {
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: 'dot' | 'line' | 'dashed';
  nameKey?: string;
  labelKey?: string;
  valueFormatter?: (value: number, dataKey: string) => React.ReactNode;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel,
  hideIndicator,
  indicator = 'dot',
  nameKey,
  labelKey,
  valueFormatter,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  const labelText =
    labelKey && payload?.[0]?.payload
      ? payload[0].payload[labelKey]
      : label ?? '';

  return (
    <div className='grid min-w-[140px] gap-1 rounded-lg border bg-background p-2 text-xs shadow-sm'>
      {!hideLabel && labelText && (
        <div className='text-[11px] text-muted-foreground'>{labelText}</div>
      )}
      <div className='grid gap-1'>
        {payload.map((item, index) => {
          const dataKey = String(item.dataKey ?? index);
          const nameValue =
            (nameKey && item.payload ? item.payload[nameKey] : undefined) ??
            item.name ??
            dataKey;
          const configItem = config[dataKey];
          const color =
            item.color ??
            configItem?.color ??
            (configItem ? `var(--color-${dataKey})` : 'currentColor');
          const formattedValue =
            typeof item.value === 'number' && valueFormatter
              ? valueFormatter(item.value, dataKey)
              : item.value;

          return (
            <div
              key={`${dataKey}-${index}`}
              className='flex items-center gap-2'
            >
              {!hideIndicator && (
                <span
                  className={cn(
                    'shrink-0 rounded-full',
                    indicator === 'dot' && 'h-2 w-2',
                    indicator === 'line' && 'h-[2px] w-3 rounded-none',
                    indicator === 'dashed' && 'h-[2px] w-3 rounded-none'
                  )}
                  style={{
                    backgroundColor:
                      indicator === 'dashed' ? 'transparent' : color,
                    border:
                      indicator === 'dashed'
                        ? `1px dashed ${color}`
                        : undefined,
                  }}
                />
              )}
              <span className='text-muted-foreground'>
                {configItem?.label ?? nameValue}
              </span>
              <span className='ml-auto font-medium text-foreground'>
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegend(props: LegendProps) {
  return <Legend {...props} />;
}

type ChartLegendContentProps = LegendProps & {
  nameKey?: string;
};

export function ChartLegendContent({
  payload,
  nameKey,
}: ChartLegendContentProps) {
  const { config } = useChart();

  if (!payload?.length) return null;

  return (
    <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
      {payload.map((item) => {
        const key = String(item.dataKey ?? '');
        const configItem = config[key];
        const label =
          configItem?.label ??
          (nameKey && item.payload ? item.payload[nameKey] : undefined) ??
          item.value;
        return (
          <div key={key} className='flex items-center gap-2'>
            <span
              className='h-2.5 w-2.5 rounded-full'
              style={{ backgroundColor: item.color }}
            />
            <span className='text-foreground'>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
