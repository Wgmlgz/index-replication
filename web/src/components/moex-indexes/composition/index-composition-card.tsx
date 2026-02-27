'use client';

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { Tabs } from '@/components/ui/tabs';
import type { ChartData } from '@/components/charts/index-chart';
import {
  IndexCompositionChart,
  OTHER_SERIES_COLOR,
  resolveCompositionSeriesColor,
} from '@/components/charts/composition-series-chart';
import { IndexCompositionSnapshotChart } from '@/components/charts/composition-snapshot-chart';
import { CompositionControls } from '@/components/charts/composition-controls';
import { CompositionTabPanels } from '@/components/charts/composition-tab-panels';
import { CompositionTabsList } from '@/components/charts/composition-tabs-list';
import { useMoexIndexDetailContext } from '../detail/moex-indexes-detail-context';
import { useMoexIndexComposition } from './use-moex-indexes-composition';
import type {
  CompositionTab,
} from '../detail/moex-indexes-detail.types';

const DEFAULT_TOP_COUNT = 10;
const TOP_COUNT_OPTIONS = [5, 10, 20, 50];
const DEFAULT_ISSUE_BOARD = 'EQWY';

type IndexCompositionCardProps = {
  embedded?: boolean;
};

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

export function IndexCompositionCard({
  embedded: _embedded = false,
}: IndexCompositionCardProps) {
  void _embedded;
  const {
    selectedIndex,
    chartData,
    rangeKey,
    intervalKey,
    customFrom,
    customTill,
    compositionTab,
    setCompositionTab,
    compositionSelectionMode,
    setCompositionSelectionMode,
    compositionSelectionDate,
    setCompositionSelectionDate,
    compositionTopCount,
    setCompositionTopCount,
  } = useMoexIndexDetailContext();
  const { t } = useTranslation();
  const topCount = compositionTopCount;
  const topCountForHook =
    topCount === null ? Number.MAX_SAFE_INTEGER : topCount;

  const latestTradeDate = useMemo(
    () => resolveChartDate(chartData),
    [chartData],
  );
  useEffect(() => {
    if (compositionSelectionDate.trim().length > 0) return;
    if (!latestTradeDate) return;
    setCompositionSelectionDate(latestTradeDate);
  }, [compositionSelectionDate, latestTradeDate, setCompositionSelectionDate]);

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
    compositionSelectionMode,
    compositionSelectionDate,
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
        secId: '',
        name: t('moex.composition.other'),
        weight: snapshotOtherWeight,
        tradeDate: snapshotDate ?? '',
      },
    ];
  }, [snapshotOtherWeight, snapshotDate, snapshotTop, t]);
  const snapshotByTicker = useMemo(() => {
    const map = new Map(snapshotItems.map(item => [item.ticker, item]));
    return map;
  }, [snapshotItems]);
  const effectiveTopCount =
    snapshotItems.length > 0
      ? Math.min(resolvedTopCount, snapshotItems.length)
      : resolvedTopCount;
  const trendLoading = snapshotLoading || seriesLoading;
  const trendError = snapshotError || seriesError;
  const showLegend = true;
  // compositionTab !== 'snapshot' &&
  // !trendLoading &&
  // !trendError &&
  // series.length > 0;
  const showOtherLegend =
    (compositionTab === 'stacked' || compositionTab === 'snapshot') &&
    snapshotOtherWeight > 0.01;
  const showSnapshotSkeleton = snapshotLoading && snapshotTop.length === 0;
  const showTrendSkeleton = trendLoading && series.length === 0;
  const selectedSecid = selectedIndex?.secid ?? '';
  const shouldShowAsOf = useMemo(() => {
    if (!snapshotDate) return false;
    if (compositionSelectionMode === 'rolling') return true;
    const selectedDate = compositionSelectionDate.trim();
    if (!selectedDate) return true;
    return snapshotDate !== selectedDate;
  }, [compositionSelectionDate, compositionSelectionMode, snapshotDate]);
  const compositionSourceLabel = selectedSecid
    ? t('moex.sources.indexConstituents', { secid: selectedSecid })
    : t('moex.sources.selectIndex');
  const compositionHref = selectedSecid
    ? moexSourceLinks.indexConstituents(selectedSecid)
    : undefined;

  return (
    <>
      <Tabs
        value={compositionTab}
        onValueChange={next => setCompositionTab(next as CompositionTab)}
        className='flex h-full flex-col'
      >
        <div className='flex h-full min-h-0 flex-col gap-4 lg:flex-row'>
          <div className='flex w-full flex-col gap-4 lg:w-[320px]'>
            <div className='flex items-start justify-between gap-2'>
              <div className='space-y-1'>
                <CardTitle>{t('moex.composition.title')}</CardTitle>
                {shouldShowAsOf && (
                  <div className='text-xs text-muted-foreground'>
                    {t('moex.composition.asOf', { date: snapshotDate })}
                  </div>
                )}
              </div>
              <MoexSourceButton
                href={compositionHref}
                label={compositionSourceLabel}
                tooltip={compositionSourceLabel}
                disabledTooltip={t('moex.sources.selectIndex')}
                className='shrink-0'
              />
            </div>
            <CompositionTabsList translationKeyPrefix='moex.composition' />
            <CompositionControls
              translationKeyPrefix='moex.composition'
              topCount={topCount}
              setTopCount={setCompositionTopCount}
              topCountOptions={topCountOptions}
              selectionMode={compositionSelectionMode}
              setSelectionMode={setCompositionSelectionMode}
              selectionDate={compositionSelectionDate}
              setSelectionDate={setCompositionSelectionDate}
              selectionDateMax={latestTradeDate ?? undefined}
              idPrefix='moex'
            />
            <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
              {selectedIndex && (
                <Badge variant='outline'>{selectedIndex.secid}</Badge>
              )}
              <Badge variant='outline'>
                {t('moex.composition.topCount', { count: effectiveTopCount })}
              </Badge>
            </div>
            {showLegend && (
              <div className='flex h-full flex-col gap-2 overflow-y-auto pr-2 text-xs text-muted-foreground'>
                <div className='h-full w-full relative'>
                  <div className='absolute'>
                    {series.map((item, index) => {
                      const latestPoint = item.data[item.data.length - 1];
                      const snapshotPoint = snapshotByTicker.get(item.id);
                      return (
                        <div key={item.id} className='flex items-center gap-2'>
                          <span
                            className='h-2.5 w-2.5 rounded-full'
                            style={{
                              backgroundColor:
                                resolveCompositionSeriesColor(index),
                            }}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={moexSourceLinks.issuePage(
                                  item.id,
                                  DEFAULT_ISSUE_BOARD,
                                )}
                                target='_blank'
                                rel='noreferrer noopener'
                                className='inline-flex items-center gap-2 hover:underline'
                                aria-label={t(
                                  'moex.composition.legend.openTicker',
                                )}
                              >
                                <span className='font-medium text-foreground'>
                                  {item.id}
                                </span>
                                <span className='hidden sm:inline'>
                                  {item.name}
                                </span>
                              </a>
                            </TooltipTrigger>
                            <TooltipContent
                              side='right'
                              className='max-w-[260px]'
                            >
                              <div className='grid gap-1'>
                                <div className='font-semibold'>{item.id}</div>
                                {item.name !== item.id && (
                                  <div>{item.name}</div>
                                )}
                                {latestPoint && (
                                  <>
                                    <div>
                                      {t(
                                        'moex.composition.legend.latestWeight',
                                        {
                                          value: latestPoint.value.toFixed(2),
                                        },
                                      )}
                                    </div>
                                    <div>
                                      {t('moex.composition.legend.asOf', {
                                        date: latestPoint.time,
                                      })}
                                    </div>
                                  </>
                                )}
                                {snapshotPoint && (
                                  <div>
                                    {t(
                                      'moex.composition.legend.snapshotWeight',
                                      {
                                        value: snapshotPoint.weight.toFixed(2),
                                      },
                                    )}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })}
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
                </div>
              </div>
            )}
          </div>
          <div className='col-span-3 flex min-h-[200px] flex-1 flex-col'>
            <CompositionTabPanels
              translationKeyPrefix='moex.composition'
              snapshotLoading={snapshotLoading}
              snapshotError={snapshotError}
              snapshotEmpty={snapshotTop.length === 0}
              showSnapshotSkeleton={showSnapshotSkeleton}
              snapshotChart={
                <IndexCompositionSnapshotChart items={snapshotChartItems} />
              }
              trendLoading={trendLoading}
              trendError={trendError}
              trendEmpty={series.length === 0}
              showTrendSkeleton={showTrendSkeleton}
              trendChart={
                <div className='min-h-[200px] flex-1'>
                  <IndexCompositionChart series={series} variant='line' />
                </div>
              }
              stackedChart={
                <div className='min-h-[200px] flex-1'>
                  <IndexCompositionChart
                    series={series}
                    variant='stacked'
                    includeOther
                  />
                </div>
              }
              snapshotClassName='flex-1'
              trendClassName='flex h-full flex-col'
              stackedClassName='flex h-full flex-col'
            />
          </div>
        </div>
      </Tabs>
    </>
  );
}
