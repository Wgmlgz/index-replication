'use client';

import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type CompositionTabPanelsProps = {
  translationKeyPrefix: string;
  snapshotLoading: boolean;
  snapshotError: boolean;
  snapshotEmpty: boolean;
  showSnapshotSkeleton?: boolean;
  snapshotChart: ReactNode;
  trendLoading: boolean;
  trendError: boolean;
  trendEmpty: boolean;
  showTrendSkeleton?: boolean;
  trendChart: ReactNode;
  stackedChart: ReactNode;
  snapshotClassName?: string;
  trendClassName?: string;
  stackedClassName?: string;
  snapshotSkeletonClassName?: string;
  trendSkeletonClassName?: string;
};

export function CompositionTabPanels({
  translationKeyPrefix,
  snapshotLoading,
  snapshotError,
  snapshotEmpty,
  showSnapshotSkeleton,
  snapshotChart,
  trendLoading,
  trendError,
  trendEmpty,
  showTrendSkeleton,
  trendChart,
  stackedChart,
  snapshotClassName,
  trendClassName,
  stackedClassName,
  snapshotSkeletonClassName,
  trendSkeletonClassName,
}: CompositionTabPanelsProps) {
  const { t } = useTranslation();

  return (
    <>
      <TabsContent value='snapshot' className={cn(snapshotClassName)}>
        {showSnapshotSkeleton && (
          <Skeleton
            className={cn(
              'h-full min-h-[240px] w-full',
              snapshotSkeletonClassName
            )}
          />
        )}
        {!snapshotLoading && snapshotError && (
          <div className='text-sm text-muted-foreground'>
            {t(`${translationKeyPrefix}.error`)}
          </div>
        )}
        {!snapshotLoading && !snapshotError && snapshotEmpty && (
          <div className='text-sm text-muted-foreground'>
            {t(`${translationKeyPrefix}.noData`)}
          </div>
        )}
        {!snapshotLoading && !snapshotError && !snapshotEmpty && snapshotChart}
      </TabsContent>

      <TabsContent value='trend' className={cn(trendClassName)}>
        {showTrendSkeleton && (
          <Skeleton
            className={cn('h-full min-h-[200px] w-full', trendSkeletonClassName)}
          />
        )}
        {!trendLoading && trendError && (
          <div className='text-sm text-muted-foreground'>
            {t(`${translationKeyPrefix}.error`)}
          </div>
        )}
        {!trendLoading && !trendError && trendEmpty && (
          <div className='text-sm text-muted-foreground'>
            {t(`${translationKeyPrefix}.noSeries`)}
          </div>
        )}
        {!trendLoading && !trendError && !trendEmpty && trendChart}
      </TabsContent>

      <TabsContent value='stacked' className={cn(stackedClassName)}>
        {showTrendSkeleton && (
          <Skeleton
            className={cn('h-full min-h-[200px] w-full', trendSkeletonClassName)}
          />
        )}
        {!trendLoading && trendError && (
          <div className='text-sm text-muted-foreground'>
            {t(`${translationKeyPrefix}.error`)}
          </div>
        )}
        {!trendLoading && !trendError && trendEmpty && (
          <div className='text-sm text-muted-foreground'>
            {t(`${translationKeyPrefix}.noSeries`)}
          </div>
        )}
        {!trendLoading && !trendError && !trendEmpty && stackedChart}
      </TabsContent>
    </>
  );
}
