'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChartData } from '../detail/index-chart';
import {
  IndexCompositionChart,
  OTHER_SERIES_COLOR,
  resolveCompositionSeriesColor,
} from './index-composition-chart';
import { IndexCompositionSnapshotChart } from './index-composition-snapshot-chart';
import { useMoexIndexDetailContext } from '../detail/moex-indexes-detail-context';
import { useMoexIndexComposition } from './use-moex-indexes-composition';
import type { CompositionTab } from '../detail/moex-indexes-detail.types';

const DEFAULT_TOP_COUNT = 8;
const TOP_COUNT_OPTIONS = [5, 8, 12, 20, 50];

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
    intervalKey,
    customFrom,
    customTill,
    compositionTab,
    setCompositionTab,
  } = useMoexIndexDetailContext();
  const { t } = useTranslation();
  const [topCount, setTopCount] = useState<number | null>(DEFAULT_TOP_COUNT);
  const topCountForHook =
    topCount === null ? Number.MAX_SAFE_INTEGER : topCount;

  const latestTradeDate = useMemo(
    () => resolveChartDate(chartData),
    [chartData],
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
    intervalKey,
    customFrom,
    customTill,
    latestTradeDate,
    topCount: topCountForHook,
    compositionTab,
  });

  const resolvedTopCount = useMemo(() => {
    const maxCount = snapshotItems.length;
    if (topCount === null) {
      return maxCount > 0 ? maxCount : DEFAULT_TOP_COUNT;
    }
    if (maxCount > 0) return Math.min(topCount, maxCount);
    return topCount;
  }, [snapshotItems.length, topCount]);

  useEffect(() => {
    if (topCount === null) return;
    if (snapshotItems.length === 0) return;
    if (topCount > snapshotItems.length) {
      setTopCount(snapshotItems.length);
    }
  }, [snapshotItems.length, topCount]);

  const topCountOptions = useMemo(() => {
    const options = new Set<number>(TOP_COUNT_OPTIONS);
    options.add(DEFAULT_TOP_COUNT);
    return Array.from(options).sort((a, b) => a - b);
  }, []);

  const snapshotTop = snapshotItems.slice(0, resolvedTopCount);
  const snapshotOtherWeight = useMemo(() => {
    if (snapshotTop.length === 0) return 0;
    const total = snapshotTop.reduce(
      (sum, item) => sum + (item.weight ?? 0),
      0,
    );
    const other = Math.max(0, 100 - total);
    return other;
  }, [snapshotTop]);
  const snapshotChartItems = useMemo(() => {
    if (snapshotOtherWeight <= 0.01) return snapshotTop;
    return [
      ...snapshotTop,
      {
        ticker: t('moex.composition.other'),
        name: t('moex.composition.other'),
        weight: snapshotOtherWeight,
        tradeDate: snapshotDate ?? '',
      },
    ];
  }, [snapshotOtherWeight, snapshotDate, snapshotTop, t]);
  const effectiveTopCount =
    snapshotItems.length > 0
      ? Math.min(resolvedTopCount, snapshotItems.length)
      : resolvedTopCount;
  const trendLoading = snapshotLoading || seriesLoading;
  const trendError = snapshotError || seriesError;
  const showLegend =
    compositionTab !== 'snapshot' &&
    !trendLoading &&
    !trendError &&
    series.length > 0;
  const showOtherLegend =
    compositionTab === 'stacked' && snapshotOtherWeight > 0.01;

  return (
    <Card className='flex h-full flex-col'>
      <Tabs
        value={compositionTab}
        onValueChange={next => setCompositionTab(next as CompositionTab)}
        className='flex h-full flex-col'
      >
        <CardContent className='flex h-full min-h-0 flex-col gap-4 pt-6 lg:flex-row'>
          <div className='flex w-full flex-col gap-4 lg:w-[320px]'>
            <div className='flex items-start justify-between gap-2'>
              <div className='space-y-1'>
                <CardTitle>{t('moex.composition.title')}</CardTitle>
                {snapshotDate && (
                  <div className='text-xs text-muted-foreground'>
                    {t('moex.composition.asOf', { date: snapshotDate })}
                  </div>
                )}
              </div>
            </div>
            <TabsList className='w-full justify-start'>
              <TabsTrigger value='snapshot'>
                {t('moex.composition.tabs.snapshot')}
              </TabsTrigger>
              <TabsTrigger value='trend'>
                {t('moex.composition.tabs.trend')}
              </TabsTrigger>
              <TabsTrigger value='stacked'>
                {t('moex.composition.tabs.stacked')}
              </TabsTrigger>
            </TabsList>
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <span>{t('moex.composition.topLabel')}</span>
              <Select
                value={topCount === null ? 'all' : String(topCount)}
                onValueChange={value => {
                  if (value === 'all') {
                    setTopCount(null);
                    return;
                  }
                  const parsed = Number.parseInt(value, 10);
                  if (Number.isFinite(parsed)) setTopCount(parsed);
                }}
              >
                <SelectTrigger size='sm' className='h-7 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {topCountOptions.map(value => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                  {snapshotItems.length > 0 && (
                    <SelectItem value='all'>
                      {t('moex.composition.all')}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
              {selectedIndex && (
                <Badge variant='outline'>{selectedIndex.secid}</Badge>
              )}
              <Badge variant='outline'>
                {t('moex.composition.topCount', { count: effectiveTopCount })}
              </Badge>
            </div>
            {showLegend && (
              <div className='flex max-h-48 flex-col gap-2 overflow-y-auto pr-2 text-xs text-muted-foreground'>
                {series.map((item, index) => (
                  <div key={item.id} className='flex items-center gap-2'>
                    <span
                      className='h-2.5 w-2.5 rounded-full'
                      style={{
                        backgroundColor: resolveCompositionSeriesColor(index),
                      }}
                    />
                    <span className='font-medium text-foreground'>
                      {item.id}
                    </span>
                    <span className='hidden sm:inline'>{item.name}</span>
                  </div>
                ))}
                {showOtherLegend && (
                  <div
                    key='composition-other'
                    className='flex items-center gap-2'
                  >
                    <span
                      className='h-2.5 w-2.5 rounded-full'
                      style={{ backgroundColor: OTHER_SERIES_COLOR }}
                    />
                    <span className='font-medium text-foreground'>
                      {t('moex.composition.other')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className='flex min-h-[200px] flex-1 flex-col'>
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
              {!snapshotLoading &&
                !snapshotError &&
                snapshotTop.length === 0 && (
                  <div className='text-sm text-muted-foreground'>
                    {t('moex.composition.noData')}
                  </div>
                )}
              {!snapshotLoading && !snapshotError && snapshotTop.length > 0 && (
                <div className='min-h-[240px] flex-1'>
                  <IndexCompositionSnapshotChart items={snapshotChartItems} />
                </div>
              )}
            </TabsContent>
            <TabsContent value='trend' className='flex h-full flex-col'>
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
                <div className='min-h-[200px] flex-1'>
                  <IndexCompositionChart series={series} variant='line' />
                </div>
              )}
            </TabsContent>
            <TabsContent value='stacked' className='flex h-full flex-col'>
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
                <div className='min-h-[200px] flex-1'>
                  <IndexCompositionChart
                    series={series}
                    variant='stacked'
                    includeOther
                  />
                </div>
              )}
            </TabsContent>
          </div>
        </CardContent>
      </Tabs>
    </Card>
  );
}
