'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ButtonToggleGroup,
  type ButtonToggleGroupOption,
  type ButtonToggleGroupSelectOption,
} from '@/components/ui/button-toggle-group';
import { CandlestickChart, DollarSign, LineChart, Percent } from 'lucide-react';
import { isIndexInactive } from '@/components/moex-indexes/moex-indexes-activity';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { IndexChart } from './index-chart';
import { useMoexIndexDetailContext } from './moex-indexes-detail-context';
import {
  EXTRA_RANGE_OPTIONS,
  EXTRA_INTERVAL_OPTIONS,
  INTERVAL_OPTIONS,
  QUICK_INTERVAL_KEYS,
  QUICK_RANGE_KEYS,
  RANGE_OPTIONS,
} from './use-moex-indexes-detail.utils';
import type { IntervalKey, RangeKey } from './moex-indexes-detail.types';

type IndexChartCardProps = {
  embedded?: boolean;
};

export function IndexChartCard({ embedded = false }: IndexChartCardProps) {
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

  const rangeLabel = useMemo(() => {
    const option = RANGE_OPTIONS.find(item => item.value === rangeKey);
    if (rangeKey !== 'custom') {
      return option ? t(option.labelKey) : rangeKey;
    }
    if (customFrom && customTill) {
      return t('moex.chart.range.customRange', {
        from: customFrom,
        till: customTill,
      });
    }
    return option ? t(option.labelKey) : rangeKey;
  }, [customFrom, customTill, rangeKey, t]);

  const isQuickRange = QUICK_RANGE_KEYS.includes(rangeKey);
  const isQuickInterval = QUICK_INTERVAL_KEYS.includes(intervalKey);
  const isInactive =
    selectedIndex && selectedIndex.lastActiveDate
      ? isIndexInactive(selectedIndex.lastActiveDate)
      : false;
  const showChartSkeleton = historyLoading && chartData.length === 0;
  const viewModeOptions: ButtonToggleGroupOption<typeof viewMode>[] = [
    {
      value: 'price',
      label: t('moex.chart.view.price'),
      content: <DollarSign className='size-4' />,
    },
    {
      value: 'percent',
      label: t('moex.chart.view.percent'),
      content: <Percent className='size-4' />,
    },
  ];
  const chartTypeOptions: ButtonToggleGroupOption<typeof chartType>[] = [
    {
      value: 'line',
      label: t('moex.chart.type.line'),
      content: <LineChart className='size-4' />,
    },
    {
      value: 'candlestick',
      label: t('moex.chart.type.candlestick'),
      content: <CandlestickChart className='size-4' />,
    },
  ];
  const rangeOptions: ButtonToggleGroupOption<RangeKey>[] =
    QUICK_RANGE_KEYS.map(key => {
      const option = RANGE_OPTIONS.find(item => item.value === key);
      if (!option) return null;
      return {
        value: key,
        label: t(option.labelKey),
        content: t(option.labelKey),
      };
    }).filter(option => option !== null);
  const rangeSelectOptions: ButtonToggleGroupSelectOption<RangeKey>[] =
    EXTRA_RANGE_OPTIONS.map(option => ({
      value: option.value,
      label: t(option.labelKey),
    }));
  const intervalOptions: ButtonToggleGroupOption<IntervalKey>[] =
    QUICK_INTERVAL_KEYS.map(key => {
      const option = INTERVAL_OPTIONS.find(item => item.value === key);
      if (!option) return null;
      return {
        value: key,
        label: t(option.labelKey),
        content: t(option.labelKey),
      };
    }).filter(option => option !== null);
  const intervalSelectOptions: ButtonToggleGroupSelectOption<IntervalKey>[] =
    EXTRA_INTERVAL_OPTIONS.map(option => ({
      value: option.value,
      label: t(option.labelKey),
    }));

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
        <div className='flex flex-col gap-3 lg:w-[340px]'>
          {selectedIndex && (
            <>
              <div className='space-y-2'>
                {latestValue !== null && (
                  <div className='text-sm'>
                    <span className='font-medium'>
                      {numberFormatter.format(latestValue)}
                    </span>
                    {selectedIndex.currency ? ` ${selectedIndex.currency}` : ''}
                    {change !== null && changePercent !== null && (
                      <span
                        className={`ml-2 text-sm font-medium ${
                          change > 0
                            ? 'text-emerald-600'
                            : change < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {change > 0 ? '+' : ''}
                        {numberFormatter.format(change)} (
                        {change > 0 ? '+' : ''}
                        {changePercent.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className='space-y-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {t('moex.chart.range.label')}
                  </span>
                  <ButtonToggleGroup
                    value={rangeKey}
                    options={rangeOptions}
                    onValueChange={setRangeKey}
                    select={{
                      value: isQuickRange ? undefined : rangeKey,
                      placeholder: t('moex.chart.range.more'),
                      options: rangeSelectOptions,
                      onValueChange: setRangeKey,
                    }}
                  />
                </div>
                {rangeKey === 'custom' && (
                  <div className='flex flex-wrap items-end gap-3'>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='moex-chart-from'
                        className='text-xs text-muted-foreground'
                      >
                        {t('moex.chart.range.from')}
                      </Label>
                      <Input
                        id='moex-chart-from'
                        type='date'
                        value={customFrom}
                        onChange={event => setCustomFrom(event.target.value)}
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label
                        htmlFor='moex-chart-to'
                        className='text-xs text-muted-foreground'
                      >
                        {t('moex.chart.range.to')}
                      </Label>
                      <Input
                        id='moex-chart-to'
                        type='date'
                        value={customTill}
                        onChange={event => setCustomTill(event.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className='space-y-3'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {t('moex.chart.interval.label')}
                  </span>
                  <ButtonToggleGroup
                    value={intervalKey}
                    options={intervalOptions}
                    onValueChange={setIntervalKey}
                    select={{
                      value: isQuickInterval ? undefined : intervalKey,
                      placeholder: t('moex.chart.interval.more'),
                      options: intervalSelectOptions,
                      onValueChange: setIntervalKey,
                    }}
                  />
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {t('moex.chart.view.label')}
                  </span>
                  <div className='flex flex-wrap gap-2'>
                    <ButtonToggleGroup
                      value={viewMode}
                      options={viewModeOptions}
                      onValueChange={setViewMode}
                    />
                  </div>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {t('moex.chart.type.label')}
                  </span>
                  <div className='flex flex-wrap gap-2'>
                    <ButtonToggleGroup
                      value={chartType}
                      options={chartTypeOptions}
                      onValueChange={setChartType}
                    />
                  </div>
                </div>
              </div>

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

        <div className='flex min-h-[200px] flex-1 items-stretch'>
          {showChartSkeleton && (
            <Skeleton className='h-full min-h-[200px] w-full' />
          )}
          {!historyLoading && chartData.length === 0 && (
            <div className='text-sm text-muted-foreground'>
              {t('moex.chart.noData')}
            </div>
          )}
          {!showChartSkeleton && chartData.length > 0 && (
            <IndexChart data={chartData} seriesType={chartType} />
          )}
        </div>
      </div>
    </div>
  );
}
