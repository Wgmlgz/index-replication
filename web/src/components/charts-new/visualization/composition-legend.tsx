'use client';

import { useTranslation } from 'react-i18next';
import { TickerWithLogo } from '@/components/ticker/ticker-with-logo';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { CompositionLegendRow } from './chart-types';
import {
  OTHER_SERIES_COLOR,
  resolveCompositionSeriesColor,
} from './composition-colors';
import { chartsNewMoexSources } from '@/components/charts-new/sources/moex-sources';

type CompositionLegendProps = {
  rows: CompositionLegendRow[];
  loading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  noDataMessage: string;
  translationKeyPrefix: string;
  showOther?: boolean;
  otherWeight?: number;
  sourceBoard?: string;
  linkBuilder?: (ticker: string) => string | undefined;
  className?: string;
};

export function CompositionLegend({
  rows,
  loading = false,
  hasError = false,
  errorMessage,
  noDataMessage,
  translationKeyPrefix,
  showOther = false,
  otherWeight = 0,
  sourceBoard = 'EQWY',
  linkBuilder,
  className,
}: CompositionLegendProps) {
  const { t } = useTranslation();
  const showSkeleton = loading && rows.length === 0;

  const resolveTickerHref = (ticker: string) => {
    if (linkBuilder) return linkBuilder(ticker);
    return chartsNewMoexSources.issuePage(ticker, sourceBoard);
  };

  return (
    <div className={cn('space-y-2', className)}>
      {showSkeleton && (
        <div className='space-y-2'>
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
        </div>
      )}
      {!loading && hasError && errorMessage && (
        <div className='text-sm text-muted-foreground'>{errorMessage}</div>
      )}
      {!loading && !hasError && rows.length === 0 && !showOther && (
        <div className='text-sm text-muted-foreground'>{noDataMessage}</div>
      )}

      {!showSkeleton && !hasError && (rows.length > 0 || showOther) && (
        <div className='space-y-2'>
          {rows.map((item, index) => {
            const tickerHref = resolveTickerHref(item.ticker);
            return (
              <div
                key={item.ticker}
                className='rounded-md border p-2 text-xs text-muted-foreground'
              >
                <div className='flex items-center gap-2'>
                  <span
                    className='h-2.5 w-2.5 shrink-0 rounded-full'
                    style={{
                      backgroundColor: resolveCompositionSeriesColor(index),
                    }}
                  />
                  {tickerHref ? (
                    <a
                      href={tickerHref}
                      target='_blank'
                      rel='noreferrer noopener'
                      className='hover:underline'
                      aria-label={t(`${translationKeyPrefix}.legend.openTicker`)}
                    >
                      <TickerWithLogo
                        ticker={item.ticker}
                        textClassName='font-medium text-foreground'
                        iconClassName='size-4'
                      />
                    </a>
                  ) : (
                    <TickerWithLogo
                      ticker={item.ticker}
                      textClassName='font-medium text-foreground'
                      iconClassName='size-4'
                    />
                  )}
                  {item.name !== item.ticker && (
                    <span className='truncate'>{item.name}</span>
                  )}
                </div>
                {item.latestWeight !== null && (
                  <div>
                    {t(`${translationKeyPrefix}.legend.latestWeight`, {
                      value: item.latestWeight.toFixed(2),
                    })}
                  </div>
                )}
                {item.latestDate && (
                  <div>
                    {t(`${translationKeyPrefix}.legend.asOf`, {
                      date: item.latestDate,
                    })}
                  </div>
                )}
                {item.snapshotWeight !== null && (
                  <div>
                    {t(`${translationKeyPrefix}.legend.snapshotWeight`, {
                      value: item.snapshotWeight.toFixed(2),
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {showOther && (
            <div className='rounded-md border p-2 text-xs text-muted-foreground'>
              <div className='flex items-center gap-2'>
                <span
                  className='h-2.5 w-2.5 shrink-0 rounded-full'
                  style={{ backgroundColor: OTHER_SERIES_COLOR }}
                />
                <span className='font-medium text-foreground'>
                  {t(`${translationKeyPrefix}.other`)}
                </span>
              </div>
              <div>
                {t(`${translationKeyPrefix}.legend.snapshotWeight`, {
                  value: otherWeight.toFixed(2),
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
