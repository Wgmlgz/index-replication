'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useTBankConnectionContext } from '@/components/tbank-test/tbank-connection-context';
import {
  CompositionSeriesChart,
  OTHER_SERIES_COLOR,
  resolveCompositionSeriesColor,
} from '@/components/charts/composition-series-chart';
import { CompositionSnapshotChart } from '@/components/charts/composition-snapshot-chart';
import { TimeSeriesChartState } from '@/components/charts/time-series-chart-state';
import { TimeSeriesControls } from '@/components/charts/time-series-controls';
import { TimeSeriesValueSummary } from '@/components/charts/time-series-value-summary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  applyChartControlsUrlState,
  parseChartControlsUrlState,
  type ChartControlsUrlCodecConfig,
} from '@/lib/charting/chart-controls-url-state';
import {
  type ChartViewMode,
  type IntervalKey,
  type RangeKey,
} from '@/lib/charting/time-series-controls';
import { useUrlStateSync } from '@/lib/url-state/use-url-state-sync';
import { usePortfolioHistory } from './use-portfolio-history';
import {
  type PortfolioCompositionSelectionMode,
  type PortfolioCompositionTab,
  usePortfolioComposition,
} from './use-portfolio-composition';

const TOP_COUNT_OPTIONS = [5, 10, 20, 50];
const PORTFOLIO_URL_KEYS = {
  accountID: 'acc',
  rangeKey: 'r',
  intervalKey: 'i',
  customFrom: 'f',
  customTill: 't',
  viewMode: 'v',
  compositionTab: 'ctab',
  compositionSelectionMode: 'cmode',
  compositionSelectionDate: 'cdate',
  compositionTopCount: 'top',
} as const;

const PORTFOLIO_CHART_URL_CODEC = {
  keys: {
    rangeKey: PORTFOLIO_URL_KEYS.rangeKey,
    intervalKey: PORTFOLIO_URL_KEYS.intervalKey,
    customFrom: PORTFOLIO_URL_KEYS.customFrom,
    customTill: PORTFOLIO_URL_KEYS.customTill,
    viewMode: PORTFOLIO_URL_KEYS.viewMode,
    compositionTab: PORTFOLIO_URL_KEYS.compositionTab,
    compositionSelectionMode: PORTFOLIO_URL_KEYS.compositionSelectionMode,
    compositionSelectionDate: PORTFOLIO_URL_KEYS.compositionSelectionDate,
    compositionTopCount: PORTFOLIO_URL_KEYS.compositionTopCount,
  },
  defaults: {
    rangeKey: '1y',
    intervalKey: 'auto',
    viewMode: 'price',
    compositionTab: 'snapshot',
    compositionSelectionMode: 'fixed',
    compositionTopCount: 10,
  },
} satisfies ChartControlsUrlCodecConfig;

const parsePortfolioUrlState = (searchParams: URLSearchParams) => {
  const accountIDRaw = searchParams.get(PORTFOLIO_URL_KEYS.accountID);
  const accountID = accountIDRaw?.trim();
  const chartControls = parseChartControlsUrlState(
    searchParams,
    PORTFOLIO_CHART_URL_CODEC
  );

  return {
    accountID: accountID && accountID.length > 0 ? accountID : undefined,
    chartControls,
  };
};

export function PortfolioAnalyticsSection() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const { status, availableAccounts, connected } = useTBankConnectionContext();

  const parsedUrl = useMemo(
    () => parsePortfolioUrlState(new URLSearchParams(urlKey)),
    [urlKey]
  );

  const [accountID, setAccountID] = useState(() => parsedUrl.accountID ?? '');
  const [rangeKey, setRangeKey] = useState<RangeKey>(
    () => parsedUrl.chartControls.rangeKey ?? '1y'
  );
  const [intervalKey, setIntervalKey] = useState<IntervalKey>(
    () => parsedUrl.chartControls.intervalKey ?? 'auto'
  );
  const [customFrom, setCustomFrom] = useState(
    () => parsedUrl.chartControls.customFrom ?? ''
  );
  const [customTill, setCustomTill] = useState(
    () => parsedUrl.chartControls.customTill ?? ''
  );
  const [viewMode, setViewMode] = useState<ChartViewMode>(
    () => parsedUrl.chartControls.viewMode ?? 'price'
  );
  const [compositionTab, setCompositionTab] = useState<PortfolioCompositionTab>(
    () => parsedUrl.chartControls.compositionTab ?? 'snapshot'
  );
  const [compositionSelectionMode, setCompositionSelectionMode] =
    useState<PortfolioCompositionSelectionMode>(
      () => parsedUrl.chartControls.compositionSelectionMode ?? 'fixed'
    );
  const [compositionSelectionDate, setCompositionSelectionDate] = useState(
    () => parsedUrl.chartControls.compositionSelectionDate ?? ''
  );
  const [compositionTopCount, setCompositionTopCount] = useState<number | null>(
    () =>
      parsedUrl.chartControls.compositionTopCount === undefined
        ? 10
        : parsedUrl.chartControls.compositionTopCount
  );

  const portfolioUrlStateKey = useMemo(
    () =>
      JSON.stringify({
        accountID,
        rangeKey,
        intervalKey,
        customFrom,
        customTill,
        viewMode,
        compositionTab,
        compositionSelectionMode,
        compositionSelectionDate,
        compositionTopCount,
      }),
    [
      accountID,
      rangeKey,
      intervalKey,
      customFrom,
      customTill,
      viewMode,
      compositionTab,
      compositionSelectionMode,
      compositionSelectionDate,
      compositionTopCount,
    ]
  );

  useUrlStateSync({
    pathname,
    urlKey,
    stateKey: portfolioUrlStateKey,
    parse: parsePortfolioUrlState,
    applyParsedState: next => {
      setAccountID(next.accountID ?? '');
      setRangeKey(next.chartControls.rangeKey ?? '1y');
      setIntervalKey(next.chartControls.intervalKey ?? 'auto');
      setCustomFrom(next.chartControls.customFrom ?? '');
      setCustomTill(next.chartControls.customTill ?? '');
      setViewMode(next.chartControls.viewMode ?? 'price');
      setCompositionTab(next.chartControls.compositionTab ?? 'snapshot');
      setCompositionSelectionMode(
        next.chartControls.compositionSelectionMode ?? 'fixed'
      );
      setCompositionSelectionDate(next.chartControls.compositionSelectionDate ?? '');
      setCompositionTopCount(
        next.chartControls.compositionTopCount === undefined
          ? 10
          : next.chartControls.compositionTopCount
      );
    },
    buildSearchParams: () => {
      const next = new URLSearchParams(window.location.search);
      next.delete(PORTFOLIO_URL_KEYS.accountID);

      const accountIDValue = accountID.trim();
      if (accountIDValue.length > 0) {
        next.set(PORTFOLIO_URL_KEYS.accountID, accountIDValue);
      }

      applyChartControlsUrlState(
        next,
        {
          rangeKey,
          intervalKey,
          customFrom,
          customTill,
          viewMode,
          compositionTab,
          compositionSelectionMode,
          compositionSelectionDate,
          compositionTopCount,
        },
        PORTFOLIO_CHART_URL_CODEC
      );

      return next;
    },
  });

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

          <TimeSeriesValueSummary
            latestValue={latestValue}
            change={change}
            changePercent={changePercent}
            numberFormatter={numberFormatter}
            currency={currency || undefined}
            loading={historyLoading}
            className='text-sm'
          />

          <TimeSeriesControls
            translationKeyPrefix='portfolio.chart'
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
            chartType='line'
            disableCandlestick
            candlestickLabelKey='portfolio.chart.type.candlestickDisabled'
            idPrefix='portfolio'
          />

          <TimeSeriesChartState
            loading={historyLoading}
            hasError={historyError}
            errorMessage={t('portfolio.chart.error')}
            noDataMessage={t('portfolio.chart.noData')}
            data={chartData}
            seriesType='line'
            containerClassName='min-h-[240px]'
            chartWrapperClassName='h-[240px]'
            skeletonClassName='h-[240px] w-full min-h-0'
          />
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
