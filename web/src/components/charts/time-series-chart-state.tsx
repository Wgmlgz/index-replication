'use client';

import {
  type ChartData,
  type ChartSeriesType,
  IndexChart,
} from './index-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type TimeSeriesChartStateProps = {
  loading: boolean;
  hasError?: boolean;
  errorMessage?: string;
  noDataMessage: string;
  data: ChartData;
  seriesType: ChartSeriesType;
  containerClassName?: string;
  chartWrapperClassName?: string;
  skeletonClassName?: string;
};

export function TimeSeriesChartState({
  loading,
  hasError = false,
  errorMessage,
  noDataMessage,
  data,
  seriesType,
  containerClassName,
  skeletonClassName,
}: TimeSeriesChartStateProps) {
  const showSkeleton = loading && data.length === 0;

  return (
    <div className={cn(containerClassName)}>
      {showSkeleton && (
        <Skeleton
          className={cn('h-full min-h-[200px] w-full', skeletonClassName)}
        />
      )}
      {!loading && hasError && errorMessage && (
        <div className='text-sm text-muted-foreground'>{errorMessage}</div>
      )}
      {!loading && !hasError && data.length === 0 && (
        <div className='text-sm text-muted-foreground'>{noDataMessage}</div>
      )}
      {!showSkeleton && !hasError && data.length > 0 && (
        <IndexChart data={data} seriesType={seriesType} />
      )}
    </div>
  );
}
