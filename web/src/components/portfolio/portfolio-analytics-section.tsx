'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CandlestickChart, DollarSign, LineChart, Percent } from 'lucide-react';
import { useTBankConnectionContext } from '@/components/tbank-test/tbank-connection-context';
import { IndexChart } from '@/components/charts/index-chart';
import {
  CompositionSeriesChart,
  OTHER_SERIES_COLOR,
  resolveCompositionSeriesColor,
} from '@/components/charts/composition-series-chart';
import { CompositionSnapshotChart } from '@/components/charts/composition-snapshot-chart';
import { ButtonToggleGroup, type ButtonToggleGroupOption, type ButtonToggleGroupSelectOption } from '@/components/ui/button-toggle-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  QUICK_INTERVAL_KEYS,
  QUICK_RANGE_KEYS,
  buildExtraIntervalOptions,
  buildExtraRangeOptions,
  buildIntervalOptions,
  buildRangeOptions,
  type ChartViewMode,
  type IntervalKey,
  type RangeKey,
} from '@/lib/charting/time-series-controls';
import { usePortfolioHistory } from './use-portfolio-history';
import {
  type PortfolioCompositionSelectionMode,
  type PortfolioCompositionTab,
  usePortfolioComposition,
} from './use-portfolio-composition';

const TOP_COUNT_OPTIONS = [5, 10, 20, 50];

export function PortfolioAnalyticsSection() {
  const { t } = useTranslation();
  const { status, availableAccounts, connected } = useTBankConnectionContext();

  const [accountID, setAccountID] = useState('');
  const [rangeKey, setRangeKey] = useState<RangeKey>('1y');
  const [intervalKey, setIntervalKey] = useState<IntervalKey>('auto');
  const [customFrom, setCustomFrom] = useState('');
  const [customTill, setCustomTill] = useState('');
  const [viewMode, setViewMode] = useState<ChartViewMode>('price');
  const [compositionTab, setCompositionTab] = useState<PortfolioCompositionTab>('snapshot');
  const [compositionSelectionMode, setCompositionSelectionMode] =
    useState<PortfolioCompositionSelectionMode>('fixed');
  const [compositionSelectionDate, setCompositionSelectionDate] = useState('');
  const [compositionTopCount, setCompositionTopCount] = useState<number | null>(10);

  const resolvedAccountID = accountID || status?.default_account_id || '';
  const topCountForHook =
    compositionTopCount === null ? 0 : compositionTopCount;

  const {
    loading: historyLoading,
    error: historyError,
    chartData,
    latestValue,
    change,
    changePercent,
    currency,
    numberFormatter,
  } = usePortfolioHistory({
    accountID: resolvedAccountID,
    rangeKey,
    intervalKey,
    customFrom,
    customTill,
    viewMode,
  });

  const {
    snapshotLoading,
    snapshotError,
    snapshotDate,
    snapshotItems,
    seriesLoading,
    seriesError,
    series,
  } = usePortfolioComposition({
    accountID: resolvedAccountID,
    rangeKey,
    intervalKey,
    customFrom,
    customTill,
    compositionSelectionMode,
    compositionSelectionDate,
    topCount: topCountForHook,
    compositionTab,
  });

  const rangeOptions = buildRangeOptions('portfolio.chart');
  const intervalOptions = buildIntervalOptions('portfolio.chart');
  const extraRangeOptions = buildExtraRangeOptions('portfolio.chart');
  const extraIntervalOptions = buildExtraIntervalOptions('portfolio.chart');

  const isQuickRange = QUICK_RANGE_KEYS.includes(rangeKey);
  const isQuickInterval = QUICK_INTERVAL_KEYS.includes(intervalKey);
  const rangeToggleOptions: ButtonToggleGroupOption<RangeKey>[] =
    QUICK_RANGE_KEYS.map(key => {
      const option = rangeOptions.find(item => item.value === key);
      if (!option) return null;
      return {
        value: key,
        label: t(option.labelKey),
        content: t(option.labelKey),
      };
    }).filter(option => option !== null);
  const rangeSelectOptions: ButtonToggleGroupSelectOption<RangeKey>[] =
    extraRangeOptions.map(option => ({
      value: option.value,
      label: t(option.labelKey),
    }));

  const intervalToggleOptions: ButtonToggleGroupOption<IntervalKey>[] =
    QUICK_INTERVAL_KEYS.map(key => {
      const option = intervalOptions.find(item => item.value === key);
      if (!option) return null;
      return {
        value: key,
        label: t(option.labelKey),
        content: t(option.labelKey),
      };
    }).filter(option => option !== null);
  const intervalSelectOptions: ButtonToggleGroupSelectOption<IntervalKey>[] =
    extraIntervalOptions.map(option => ({
      value: option.value,
      label: t(option.labelKey),
    }));

  const viewModeOptions: ButtonToggleGroupOption<ChartViewMode>[] = [
    {
      value: 'price',
      label: t('portfolio.chart.view.price'),
      content: <DollarSign className='size-4' />,
    },
    {
      value: 'percent',
      label: t('portfolio.chart.view.percent'),
      content: <Percent className='size-4' />,
    },
  ];

  const chartTypeOptions: ButtonToggleGroupOption<'line' | 'candlestick'>[] = [
    {
      value: 'line',
      label: t('portfolio.chart.type.line'),
      content: <LineChart className='size-4' />,
    },
    {
      value: 'candlestick',
      label: t('portfolio.chart.type.candlestickDisabled'),
      content: <CandlestickChart className='size-4' />,
      disabled: true,
    },
  ];

  const snapshotTop = snapshotItems.slice(
    0,
    compositionTopCount === null ? snapshotItems.length : compositionTopCount
  );
  const snapshotOtherWeight = useMemo(() => {
    if (snapshotTop.length === 0) return 0;
    const total = snapshotTop.reduce((sum, item) => sum + item.weight, 0);
    return Math.max(0, 100 - total);
  }, [snapshotTop]);
  const snapshotChartItems = useMemo(() => {
    if (snapshotOtherWeight <= 0.01) return snapshotTop;
    return [
      ...snapshotTop,
      {
        ticker: t('portfolio.composition.other'),
        secId: '',
        name: t('portfolio.composition.other'),
        weight: snapshotOtherWeight,
        tradeDate: snapshotDate ?? '',
      },
    ];
  }, [snapshotDate, snapshotOtherWeight, snapshotTop, t]);

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.analytics.title')}</CardTitle>
          <CardDescription>{t('portfolio.analytics.description')}</CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.analytics.notConnected')}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='grid gap-6 lg:grid-cols-2'>
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.chart.title')}</CardTitle>
          <CardDescription>{t('portfolio.chart.description')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-2'>
            <Label htmlFor='portfolio-analytics-account'>{t('portfolio.analytics.accountLabel')}</Label>
            <select
              id='portfolio-analytics-account'
              className='border-input bg-background h-9 rounded-md border px-3 text-sm'
              value={accountID}
              onChange={event => setAccountID(event.target.value)}
            >
              <option value=''>{t('portfolio.analytics.accountDefaultOption')}</option>
              {(availableAccounts ?? []).map(account => (
                <option key={account.id} value={account.id}>
                  {account.id}
                </option>
              ))}
            </select>
          </div>

          <div className='space-y-2'>
            <div className='text-sm'>
              {latestValue !== null && (
                <>
                  <span className='font-medium'>
                    {numberFormatter.format(latestValue)}
                  </span>
                  {currency ? ` ${currency}` : ''}
                  {change !== null && changePercent !== null && (
                    <span
                      className={`ml-2 font-medium ${
                        change > 0
                          ? 'text-emerald-600'
                          : change < 0
                            ? 'text-red-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {change > 0 ? '+' : ''}
                      {numberFormatter.format(change)} ({change > 0 ? '+' : ''}
                      {changePercent.toFixed(2)}%)
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs text-muted-foreground'>
                {t('portfolio.chart.range.label')}
              </span>
              <ButtonToggleGroup
                value={rangeKey}
                options={rangeToggleOptions}
                onValueChange={setRangeKey}
                select={{
                  value: isQuickRange ? undefined : rangeKey,
                  placeholder: t('portfolio.chart.range.more'),
                  options: rangeSelectOptions,
                  onValueChange: setRangeKey,
                }}
              />
            </div>
            {rangeKey === 'custom' && (
              <div className='flex flex-wrap items-end gap-3'>
                <div className='space-y-1'>
                  <Label htmlFor='portfolio-chart-from' className='text-xs text-muted-foreground'>
                    {t('portfolio.chart.range.from')}
                  </Label>
                  <Input
                    id='portfolio-chart-from'
                    type='date'
                    value={customFrom}
                    onChange={event => setCustomFrom(event.target.value)}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='portfolio-chart-to' className='text-xs text-muted-foreground'>
                    {t('portfolio.chart.range.to')}
                  </Label>
                  <Input
                    id='portfolio-chart-to'
                    type='date'
                    value={customTill}
                    onChange={event => setCustomTill(event.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs text-muted-foreground'>
                {t('portfolio.chart.interval.label')}
              </span>
              <ButtonToggleGroup
                value={intervalKey}
                options={intervalToggleOptions}
                onValueChange={setIntervalKey}
                select={{
                  value: isQuickInterval ? undefined : intervalKey,
                  placeholder: t('portfolio.chart.interval.more'),
                  options: intervalSelectOptions,
                  onValueChange: setIntervalKey,
                }}
              />
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs text-muted-foreground'>
                {t('portfolio.chart.view.label')}
              </span>
              <ButtonToggleGroup
                value={viewMode}
                options={viewModeOptions}
                onValueChange={setViewMode}
              />
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs text-muted-foreground'>
                {t('portfolio.chart.type.label')}
              </span>
              <ButtonToggleGroup
                value='line'
                options={chartTypeOptions}
                onValueChange={() => undefined}
              />
            </div>
          </div>

          <div className='min-h-[240px]'>
            {historyLoading && <Skeleton className='h-[240px] w-full' />}
            {!historyLoading && historyError && (
              <div className='text-sm text-muted-foreground'>{t('portfolio.chart.error')}</div>
            )}
            {!historyLoading && !historyError && chartData.length === 0 && (
              <div className='text-sm text-muted-foreground'>{t('portfolio.chart.noData')}</div>
            )}
            {!historyLoading && !historyError && chartData.length > 0 && (
              <div className='h-[240px]'>
                <IndexChart data={chartData} seriesType='line' />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.composition.title')}</CardTitle>
          <CardDescription>
            {snapshotDate
              ? t('portfolio.composition.asOf', { date: snapshotDate })
              : t('portfolio.composition.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={compositionTab}
            onValueChange={next => setCompositionTab(next as PortfolioCompositionTab)}
            className='space-y-4'
          >
            <TabsList className='w-full justify-start'>
              <TabsTrigger value='snapshot'>{t('portfolio.composition.tabs.snapshot')}</TabsTrigger>
              <TabsTrigger value='trend'>{t('portfolio.composition.tabs.trend')}</TabsTrigger>
              <TabsTrigger value='stacked'>{t('portfolio.composition.tabs.stacked')}</TabsTrigger>
            </TabsList>

            <div className='flex flex-wrap items-center gap-4 text-xs text-muted-foreground'>
              <div className='flex items-center gap-2'>
                <span>{t('portfolio.composition.topLabel')}</span>
                <Select
                  value={compositionTopCount === null ? 'all' : String(compositionTopCount)}
                  onValueChange={value => {
                    if (value === 'all') {
                      setCompositionTopCount(null);
                      return;
                    }
                    const parsed = Number.parseInt(value, 10);
                    if (Number.isFinite(parsed)) setCompositionTopCount(parsed);
                  }}
                >
                  <SelectTrigger size='sm' className='h-7 text-xs w-[84px]'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOP_COUNT_OPTIONS.map(value => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                    <SelectItem value='all'>{t('portfolio.composition.all')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='flex items-center gap-2'>
                <span>{t('portfolio.composition.selectionMode.label')}</span>
                <Select
                  value={compositionSelectionMode}
                  onValueChange={value =>
                    setCompositionSelectionMode(value as PortfolioCompositionSelectionMode)
                  }
                >
                  <SelectTrigger size='sm' className='h-7 text-xs w-[120px]'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='fixed'>
                      {t('portfolio.composition.selectionMode.fixed')}
                    </SelectItem>
                    <SelectItem value='rolling'>
                      {t('portfolio.composition.selectionMode.rolling')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {compositionSelectionMode === 'fixed' && (
                <div className='flex items-center gap-2'>
                  <Label htmlFor='portfolio-composition-date' className='text-xs text-muted-foreground'>
                    {t('portfolio.composition.selectionDate')}
                  </Label>
                  <Input
                    id='portfolio-composition-date'
                    type='date'
                    className='h-7 text-xs w-[140px]'
                    value={compositionSelectionDate}
                    onChange={event => setCompositionSelectionDate(event.target.value)}
                  />
                </div>
              )}
            </div>

            <TabsContent value='snapshot' className='min-h-[240px]'>
              {snapshotLoading && <Skeleton className='h-[240px] w-full' />}
              {!snapshotLoading && snapshotError && (
                <div className='text-sm text-muted-foreground'>
                  {t('portfolio.composition.error')}
                </div>
              )}
              {!snapshotLoading && !snapshotError && snapshotTop.length === 0 && (
                <div className='text-sm text-muted-foreground'>
                  {t('portfolio.composition.noData')}
                </div>
              )}
              {!snapshotLoading && !snapshotError && snapshotTop.length > 0 && (
                <div className='h-[240px]'>
                  <CompositionSnapshotChart items={snapshotChartItems} />
                </div>
              )}
            </TabsContent>

            <TabsContent value='trend' className='min-h-[240px]'>
              {(snapshotLoading || seriesLoading) && <Skeleton className='h-[240px] w-full' />}
              {!snapshotLoading && !seriesLoading && (snapshotError || seriesError) && (
                <div className='text-sm text-muted-foreground'>
                  {t('portfolio.composition.error')}
                </div>
              )}
              {!snapshotLoading &&
                !seriesLoading &&
                !snapshotError &&
                !seriesError &&
                series.length === 0 && (
                  <div className='text-sm text-muted-foreground'>
                    {t('portfolio.composition.noSeries')}
                  </div>
                )}
              {!snapshotLoading &&
                !seriesLoading &&
                !snapshotError &&
                !seriesError &&
                series.length > 0 && (
                  <div className='h-[240px]'>
                    <CompositionSeriesChart series={series} variant='line' />
                  </div>
                )}
            </TabsContent>

            <TabsContent value='stacked' className='min-h-[240px]'>
              {(snapshotLoading || seriesLoading) && <Skeleton className='h-[240px] w-full' />}
              {!snapshotLoading && !seriesLoading && (snapshotError || seriesError) && (
                <div className='text-sm text-muted-foreground'>
                  {t('portfolio.composition.error')}
                </div>
              )}
              {!snapshotLoading &&
                !seriesLoading &&
                !snapshotError &&
                !seriesError &&
                series.length === 0 && (
                  <div className='text-sm text-muted-foreground'>
                    {t('portfolio.composition.noSeries')}
                  </div>
                )}
              {!snapshotLoading &&
                !seriesLoading &&
                !snapshotError &&
                !seriesError &&
                series.length > 0 && (
                  <div className='h-[240px]'>
                    <CompositionSeriesChart
                      series={series}
                      variant='stacked'
                      includeOther
                    />
                  </div>
                )}
            </TabsContent>
          </Tabs>

          {series.length > 0 && (
            <div className='mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground'>
              {series.map((item, index) => (
                <div key={item.id} className='flex items-center gap-2'>
                  <span
                    className='h-2.5 w-2.5 rounded-full'
                    style={{ backgroundColor: resolveCompositionSeriesColor(index) }}
                  />
                  <span>{item.id}</span>
                </div>
              ))}
              {snapshotOtherWeight > 0.01 && (
                <div className='flex items-center gap-2'>
                  <span
                    className='h-2.5 w-2.5 rounded-full'
                    style={{ backgroundColor: OTHER_SERIES_COLOR }}
                  />
                  <span>{t('portfolio.composition.other')}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
