'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CandlestickChart,
  DollarSign,
  LineChart,
  Percent,
} from 'lucide-react';
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

export function IndexChartCard() {
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
    const option = RANGE_OPTIONS.find((item) => item.value === rangeKey);
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
  const historySourceLabel = selectedIndex
    ? t('moex.sources.indexPage', { secid: selectedIndex.secid })
    : t('moex.sources.selectIndex');
  const historyHref = selectedIndex
    ? moexSourceLinks.indexPage(selectedIndex.secid)
    : undefined;

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader>
        <CardTitle>{t('moex.chart.title')}</CardTitle>
        <CardAction>
          <MoexSourceButton
            href={historyHref}
            label={historySourceLabel}
            tooltip={historySourceLabel}
            disabledTooltip={t('moex.sources.selectIndex')}
          />
        </CardAction>
      </CardHeader>
      <CardContent className='flex h-full min-h-0 flex-col gap-3'>
        <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
          <div className='flex flex-col gap-3 lg:w-[340px]'>
            {selectedIndex && (
              <>
                <div className='space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <div className='text-lg font-semibold'>
                      {selectedIndex.name}
                    </div>
                    <Badge variant='outline'>{selectedIndex.secid}</Badge>
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {t('moex.chart.period', {
                      range: rangeLabel,
                      currency: selectedIndex.currency ?? '?',
                    })}
                  </div>
                  {latestValue !== null && (
                    <div className='text-sm'>
                      <span className='font-medium'>
                        {numberFormatter.format(latestValue)}
                      </span>
                      {selectedIndex.currency
                        ? ` ${selectedIndex.currency}`
                        : ''}
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
                    <div className='flex flex-wrap gap-2'>
                      {QUICK_RANGE_KEYS.map((key) => {
                        const option = RANGE_OPTIONS.find(
                          (item) => item.value === key
                        );
                        if (!option) return null;
                        return (
                          <Button
                            key={key}
                            type='button'
                            size='sm'
                            className='h-7 px-2 text-xs'
                            variant={rangeKey === key ? 'secondary' : 'outline'}
                            onClick={() => setRangeKey(key)}
                            aria-pressed={rangeKey === key}
                          >
                            {t(option.labelKey)}
                          </Button>
                        );
                      })}
                      <Select
                        value={isQuickRange ? undefined : rangeKey}
                        onValueChange={(value) =>
                          setRangeKey(value as RangeKey)
                        }
                      >
                        <SelectTrigger size='sm' className='h-7 text-xs'>
                          <SelectValue
                            placeholder={t('moex.chart.range.more')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {EXTRA_RANGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                          onChange={(event) =>
                            setCustomFrom(event.target.value)
                          }
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
                          onChange={(event) =>
                            setCustomTill(event.target.value)
                          }
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
                    <div className='flex flex-wrap gap-2'>
                      {QUICK_INTERVAL_KEYS.map((key) => {
                        const option = INTERVAL_OPTIONS.find(
                          (item) => item.value === key
                        );
                        if (!option) return null;
                        return (
                          <Button
                            key={key}
                            type='button'
                            size='sm'
                            className='h-7 px-2 text-xs'
                            variant={intervalKey === key ? 'secondary' : 'outline'}
                            onClick={() => setIntervalKey(key)}
                            aria-pressed={intervalKey === key}
                          >
                            {t(option.labelKey)}
                          </Button>
                        );
                      })}
                      <Select
                        value={isQuickInterval ? undefined : intervalKey}
                        onValueChange={(value) =>
                          setIntervalKey(value as IntervalKey)
                        }
                      >
                        <SelectTrigger size='sm' className='h-7 text-xs'>
                          <SelectValue
                            placeholder={t('moex.chart.interval.more')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {EXTRA_INTERVAL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {t('moex.chart.view.label')}
                  </span>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      size='icon'
                      className='size-8'
                      variant={viewMode === 'price' ? 'secondary' : 'outline'}
                      onClick={() => setViewMode('price')}
                      aria-pressed={viewMode === 'price'}
                      aria-label={t('moex.chart.view.price')}
                      title={t('moex.chart.view.price')}
                    >
                      <DollarSign className='size-4' />
                    </Button>
                    <Button
                      type='button'
                      size='icon'
                      className='size-8'
                      variant={viewMode === 'percent' ? 'secondary' : 'outline'}
                      onClick={() => setViewMode('percent')}
                      aria-pressed={viewMode === 'percent'}
                      aria-label={t('moex.chart.view.percent')}
                      title={t('moex.chart.view.percent')}
                    >
                      <Percent className='size-4' />
                    </Button>
                  </div>
                </div>

                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    {t('moex.chart.type.label')}
                  </span>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      size='icon'
                      className='size-8'
                      variant={chartType === 'line' ? 'secondary' : 'outline'}
                      onClick={() => setChartType('line')}
                      aria-pressed={chartType === 'line'}
                      aria-label={t('moex.chart.type.line')}
                      title={t('moex.chart.type.line')}
                    >
                      <LineChart className='size-4' />
                    </Button>
                    <Button
                      type='button'
                      size='icon'
                      className='size-8'
                      variant={
                        chartType === 'candlestick' ? 'secondary' : 'outline'
                      }
                      onClick={() => setChartType('candlestick')}
                      aria-pressed={chartType === 'candlestick'}
                      aria-label={t('moex.chart.type.candlestick')}
                      title={t('moex.chart.type.candlestick')}
                    >
                      <CandlestickChart className='size-4' />
                    </Button>
                  </div>
                </div>

                <div className='flex flex-wrap gap-2'>
                  {selectedIndex.boardId && (
                    <Badge variant='secondary'>
                      {t('moex.chart.board', { board: selectedIndex.boardId })}
                    </Badge>
                  )}
                  {selectedIndex.calcMode && (
                    <Badge variant='secondary'>{selectedIndex.calcMode}</Badge>
                  )}
                  {selectedIndex.annualHigh !== null && (
                    <Badge variant='outline'>
                      {t('moex.chart.max', {
                        value: numberFormatter.format(selectedIndex.annualHigh),
                      })}
                    </Badge>
                  )}
                  {selectedIndex.annualLow !== null && (
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
          </div>

          <div className='flex min-h-[200px] flex-1 items-stretch'>
            {historyLoading && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.chart.loading')}
              </div>
            )}
            {!historyLoading && chartData.length === 0 && (
              <div className='text-sm text-muted-foreground'>
                {t('moex.chart.noData')}
              </div>
            )}
            {!historyLoading && chartData.length > 0 && (
              <IndexChart data={chartData} seriesType={chartType} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
