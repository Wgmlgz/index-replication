'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type TimeSeriesValueSummaryProps = {
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
  currency?: string;
  loading?: boolean;
  className?: string;
};

export function TimeSeriesValueSummary({
  latestValue,
  change,
  changePercent,
  numberFormatter,
  currency,
  loading = false,
  className,
}: TimeSeriesValueSummaryProps) {
  if (latestValue === null) {
    if (!loading) return null;
    return (
      <div className='flex items-center gap-2'>
        <Skeleton className='h-5 w-20' />
        <Skeleton className='h-5 w-16' />
      </div>
    );
  }

  return (
    <div className={cn('text-sm', className)}>
      <span className='font-medium'>{numberFormatter.format(latestValue)}</span>
      {currency ? ` ${currency}` : ''}
      {change !== null && changePercent !== null && (
        <span
          className={cn(
            'ml-2 font-medium',
            change > 0
              ? 'text-emerald-600'
              : change < 0
                ? 'text-red-600'
                : 'text-muted-foreground'
          )}
        >
          {change > 0 ? '+' : ''}
          {numberFormatter.format(change)} ({change > 0 ? '+' : ''}
          {changePercent.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}
