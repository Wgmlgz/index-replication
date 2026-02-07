'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChartData } from '../detail/index-chart';
import { IndexCompositionChart, COMPOSITION_SERIES_COLORS } from './index-composition-chart';
import { useMoexIndexDetailContext } from '../detail/moex-indexes-detail-context';
import { useMoexIndexComposition } from './use-moex-indexes-composition';

const TOP_SERIES_COUNT = 8;
const SNAPSHOT_COUNT = TOP_SERIES_COUNT;

const resolveChartDate = (chartData: ChartData): string | null => {
  if (chartData.length === 0) return null;
  const last = chartData[chartData.length - 1] as { time?: unknown };
  const time = last?.time;
  if (!time) return null;
  if (typeof time === 'string') return time;
  if (typeof time === 'number') {
    return new Date(time * 1000).toISOString().slice(0, 10);
  }
  if (typeof time === 'object') {
    const timeObj = time as { year?: number; month?: number; day?: number };
    if (timeObj.year && timeObj.month && timeObj.day) {
      const month = String(timeObj.month).padStart(2, '0');
      const day = String(timeObj.day).padStart(2, '0');
      return `${timeObj.year}-${month}-${day}`;
    }
  }
  return null;
};

export function IndexCompositionCard() {
  const {
    selectedIndex,
    chartData,
    rangeKey,
    customFrom,
    customTill,
  } = useMoexIndexDetailContext();
  const { t, i18n } = useTranslation();

  const latestTradeDate = useMemo(
    () => resolveChartDate(chartData),
    [chartData]
  );

  const {
    snapshotLoading,
    snapshotError,
    snapshotDate,
    snapshotItems,
    seriesLoading,
    seriesError,
    series,
  } = useMoexIndexComposition({
    selectedIndex,
    rangeKey,
    customFrom,
    customTill,
    latestTradeDate,
    topCount: TOP_SERIES_COUNT,
  });

  const weightFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || 'en', {
        maximumFractionDigits: 2,
      }),
    [i18n.language]
  );

  const snapshotTop = snapshotItems.slice(0, SNAPSHOT_COUNT);
  const effectiveTopCount =
    snapshotItems.length > 0
      ? Math.min(TOP_SERIES_COUNT, snapshotItems.length)
      : TOP_SERIES_COUNT;
  const trendLoading = snapshotLoading || seriesLoading;
  const trendError = snapshotError || seriesError;

  return (
    <Card className='flex h-full flex-col'>
      <Tabs defaultValue='snapshot' className='flex h-full flex-col'>
        <CardHeader className='gap-2'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='space-y-1'>
              <CardTitle>{t('moex.composition.title')}</CardTitle>
              {snapshotDate && (
                <div className='text-xs text-muted-foreground'>
                  {t('moex.composition.asOf', { date: snapshotDate })}
                </div>
              )}
            </div>
            <TabsList>
              <TabsTrigger value='snapshot'>
                {t('moex.composition.tabs.snapshot')}
              </TabsTrigger>
              <TabsTrigger value='trend'>
                {t('moex.composition.tabs.trend')}
              </TabsTrigger>
            </TabsList>
          </div>
          <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
            {selectedIndex && (
              <Badge variant='outline'>{selectedIndex.secid}</Badge>
            )}
            <Badge variant='outline'>
              {t('moex.composition.topCount', { count: effectiveTopCount })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className='flex h-full min-h-0 flex-col'>
          <TabsContent value='snapshot' className='flex-1'>
            {snapshotLoading && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.composition.loading')}
              </div>
            )}
            {!snapshotLoading && snapshotError && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.composition.error')}
              </div>
            )}
            {!snapshotLoading && !snapshotError && snapshotTop.length === 0 && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.composition.noData')}
              </div>
            )}
            {!snapshotLoading && !snapshotError && snapshotTop.length > 0 && (
              <div className='space-y-3'>
                {snapshotTop.map((item) => (
                  <div
                    key={`${item.ticker}-${item.tradeDate}`}
                    className='grid grid-cols-[160px_1fr_auto] items-center gap-3'
                  >
                    <div className='flex min-w-0 flex-col'>
                      <span className='text-xs font-semibold'>
                        {item.ticker}
                      </span>
                      <span className='truncate text-[11px] text-muted-foreground'>
                        {item.name}
                      </span>
                    </div>
                    <div className='h-2 overflow-hidden rounded-full bg-muted'>
                      <div
                        className='h-full rounded-full bg-primary'
                        style={{
                          width: `${Math.min(Math.max(item.weight, 0), 100)}%`,
                        }}
                      />
                    </div>
                    <div className='text-xs tabular-nums text-muted-foreground'>
                      {weightFormatter.format(item.weight)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value='trend' className='flex h-full flex-col gap-3'>
            {trendLoading && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.composition.loading')}
              </div>
            )}
            {!trendLoading && trendError && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.composition.error')}
              </div>
            )}
            {!trendLoading && !trendError && series.length === 0 && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.composition.noSeries')}
              </div>
            )}
            {!trendLoading && !trendError && series.length > 0 && (
              <>
                <div className='min-h-[200px] flex-1'>
                  <IndexCompositionChart series={series} />
                </div>
                <div className='flex flex-wrap gap-3 text-xs text-muted-foreground'>
                  {series.map((item, index) => (
                    <div
                      key={item.id}
                      className='flex items-center gap-2'
                    >
                      <span
                        className='h-2.5 w-2.5 rounded-full'
                        style={{
                          backgroundColor:
                            COMPOSITION_SERIES_COLORS[
                              index % COMPOSITION_SERIES_COLORS.length
                            ],
                        }}
                      />
                      <span className='font-medium text-foreground'>
                        {item.id}
                      </span>
                      <span className='hidden sm:inline'>
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
