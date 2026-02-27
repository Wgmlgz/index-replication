'use client';

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { isIndexInactive } from '@/components/moex-indexes/moex-indexes-activity';
import { TimeSeriesChartState } from '@/components/charts/time-series-chart-state';
import { TimeSeriesControls } from '@/components/charts/time-series-controls';
import { TimeSeriesValueSummary } from '@/components/charts/time-series-value-summary';
import { useMoexIndexDetailContext } from './moex-indexes-detail-context';

type IndexChartCardProps = {
  embedded?: boolean;
};

export function IndexChartCard({ embedded = false }: IndexChartCardProps) {
  void embedded;
  const {
    selectedIndex,
    selectedIndexCollections,
    latestValue,
    change,
    changePercent,
    numberFormatter,
    historyLoading,
    chartData,
    rangeKey,
    setRangeKey,
    intervalKey,
    setIntervalKey,
    customFrom,
    customTill,
    setCustomFrom,
    setCustomTill,
    viewMode,
    setViewMode,
    chartType,
    setChartType,
  } = useMoexIndexDetailContext();
  const { t } = useTranslation();

  const collectionPreview = selectedIndexCollections.slice(0, 3);
  const remainingCollections =
    selectedIndexCollections.length > 3
      ? selectedIndexCollections.length - 3
      : 0;

  const groupsLabel = selectedIndex
    ? selectedIndexCollections.length > 0
      ? remainingCollections > 0
        ? t('moex.groups.more', {
            groups: collectionPreview.join(', '),
            count: remainingCollections,
          })
        : t('moex.groups.list', {
            groups: collectionPreview.join(', '),
          })
      : t('moex.groups.none')
    : '';

  const isInactive =
    selectedIndex && selectedIndex.lastActiveDate
      ? isIndexInactive(selectedIndex.lastActiveDate)
      : false;

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
        <div className='flex flex-col gap-3 lg:w-[320px]'>
          {selectedIndex && (
            <>
              <TimeSeriesValueSummary
                latestValue={latestValue}
                change={change}
                changePercent={changePercent}
                numberFormatter={numberFormatter}
                currency={selectedIndex.currency ?? undefined}
                loading={historyLoading}
                className='text-sm'
              />

              <TimeSeriesControls
                translationKeyPrefix='moex.chart'
                rangeKey={rangeKey}
                setRangeKey={setRangeKey}
                intervalKey={intervalKey}
                setIntervalKey={setIntervalKey}
                customFrom={customFrom}
                setCustomFrom={setCustomFrom}
                customTill={customTill}
                setCustomTill={setCustomTill}
                viewMode={viewMode}
                setViewMode={setViewMode}
                chartType={chartType}
                setChartType={setChartType}
                idPrefix='moex'
              />

              <div className='flex flex-wrap gap-2'>
                {selectedIndex.currency && (
                  <Badge variant='secondary'>{selectedIndex.currency}</Badge>
                )}
                {selectedIndex.boardId && (
                  <Badge variant='secondary'>
                    {t('moex.chart.board', { board: selectedIndex.boardId })}
                  </Badge>
                )}
                {selectedIndex.calcMode && (
                  <Badge variant='secondary'>{selectedIndex.calcMode}</Badge>
                )}
                {isInactive && selectedIndex.lastActiveDate && (
                  <Badge
                    variant='outline'
                    className='border-amber-300/80 text-amber-700'
                  >
                    {t('moex.status.inactiveSince', {
                      date: selectedIndex.lastActiveDate,
                    })}
                  </Badge>
                )}
                {selectedIndex.annualHigh != null && (
                  <Badge variant='outline'>
                    {t('moex.chart.max', {
                      value: numberFormatter.format(selectedIndex.annualHigh),
                    })}
                  </Badge>
                )}
                {selectedIndex.annualLow != null && (
                  <Badge variant='outline'>
                    {t('moex.chart.min', {
                      value: numberFormatter.format(selectedIndex.annualLow),
                    })}
                  </Badge>
                )}
              </div>
              {groupsLabel && (
                <div className='text-xs text-muted-foreground'>
                  {groupsLabel}
                </div>
              )}
            </>
          )}
          {!selectedIndex && historyLoading && (
            <div className='space-y-3'>
              <Skeleton className='h-5 w-48' />
              <Skeleton className='h-4 w-36' />
              <Skeleton className='h-8 w-52' />
              <div className='flex flex-wrap gap-2'>
                <Skeleton className='h-6 w-16' />
                <Skeleton className='h-6 w-20' />
                <Skeleton className='h-6 w-24' />
              </div>
            </div>
          )}
        </div>

        <TimeSeriesChartState
          loading={historyLoading}
          noDataMessage={t('moex.chart.noData')}
          data={chartData}
          seriesType={chartType}
          containerClassName='flex min-h-[200px] flex-1 items-stretch'
        />
      </div>
    </div>
  );
}
