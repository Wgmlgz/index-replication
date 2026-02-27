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
import { CompositionControls } from '@/components/charts/composition-controls';
import { CompositionSnapshotChart } from '@/components/charts/composition-snapshot-chart';
import { CompositionTabPanels } from '@/components/charts/composition-tab-panels';
import { CompositionTabsList } from '@/components/charts/composition-tabs-list';
import { TimeSeriesChartState } from '@/components/charts/time-series-chart-state';
import { TimeSeriesControls } from '@/components/charts/time-series-controls';
import { TimeSeriesValueSummary } from '@/components/charts/time-series-value-summary';
import { buildSnapshotChartItems } from '@/components/charts/composition-analytics';
import { useChartControlsState } from '@/components/charts/use-chart-controls-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs } from '@/components/ui/tabs';
import {
  applyChartControlsUrlState,
  parseChartControlsUrlState,
  type ChartControlsUrlCodecConfig,
} from '@/lib/charting/chart-controls-url-state';
import { useUrlStateSync } from '@/lib/url-state/use-url-state-sync';
import { usePortfolioHistory } from './use-portfolio-history';
import {
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
  const chartControls = useChartControlsState({
    initial: parsedUrl.chartControls,
    defaults: {
      rangeKey: '1y',
      intervalKey: 'auto',
      viewMode: 'price',
      compositionTab: 'snapshot',
      compositionSelectionMode: 'fixed',
      compositionTopCount: 10,
    },
  });

  const portfolioUrlStateKey = useMemo(
    () =>
      JSON.stringify({
        accountID,
        chartControls: chartControls.controlsStateKey,
      }),
    [accountID, chartControls.controlsStateKey]
  );

  useUrlStateSync({
    pathname,
    urlKey,
    stateKey: portfolioUrlStateKey,
    parse: parsePortfolioUrlState,
    applyParsedState: next => {
      setAccountID(next.accountID ?? '');
      chartControls.applyParsedControls(next.chartControls);
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
          rangeKey: chartControls.rangeKey,
          intervalKey: chartControls.intervalKey,
          customFrom: chartControls.customFrom,
          customTill: chartControls.customTill,
          viewMode: chartControls.viewMode,
          compositionTab: chartControls.compositionTab,
          compositionSelectionMode: chartControls.compositionSelectionMode,
          compositionSelectionDate: chartControls.compositionSelectionDate,
          compositionTopCount: chartControls.compositionTopCount,
        },
        PORTFOLIO_CHART_URL_CODEC
      );

      return next;
    },
  });

  const resolvedAccountID = accountID || status?.default_account_id || '';
  const topCountForHook =
    chartControls.compositionTopCount === null ? 0 : chartControls.compositionTopCount;

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
    rangeKey: chartControls.rangeKey,
    intervalKey: chartControls.intervalKey,
    customFrom: chartControls.customFrom,
    customTill: chartControls.customTill,
    viewMode: chartControls.viewMode,
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
    rangeKey: chartControls.rangeKey,
    intervalKey: chartControls.intervalKey,
    customFrom: chartControls.customFrom,
    customTill: chartControls.customTill,
    compositionSelectionMode: chartControls.compositionSelectionMode,
    compositionSelectionDate: chartControls.compositionSelectionDate,
    topCount: topCountForHook,
    compositionTab: chartControls.compositionTab,
  });

  const snapshotTop = snapshotItems.slice(
    0,
    chartControls.compositionTopCount === null
      ? snapshotItems.length
      : chartControls.compositionTopCount
  );
  const { snapshotChartItems, snapshotOtherWeight } = useMemo(
    () =>
      buildSnapshotChartItems(snapshotTop, {
        otherLabel: t('portfolio.composition.other'),
        snapshotDate,
      }),
    [snapshotDate, snapshotTop, t]
  );

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
              rangeKey={chartControls.rangeKey}
              setRangeKey={chartControls.setRangeKey}
              intervalKey={chartControls.intervalKey}
              setIntervalKey={chartControls.setIntervalKey}
              customFrom={chartControls.customFrom}
              setCustomFrom={chartControls.setCustomFrom}
              customTill={chartControls.customTill}
              setCustomTill={chartControls.setCustomTill}
              viewMode={chartControls.viewMode}
              setViewMode={chartControls.setViewMode}
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
            value={chartControls.compositionTab}
            onValueChange={next =>
              chartControls.setCompositionTab(next as PortfolioCompositionTab)
            }
            className='space-y-4'
          >
            <CompositionTabsList translationKeyPrefix='portfolio.composition' />

            <CompositionControls
              translationKeyPrefix='portfolio.composition'
              topCount={chartControls.compositionTopCount}
              setTopCount={chartControls.setCompositionTopCount}
              topCountOptions={TOP_COUNT_OPTIONS}
              selectionMode={chartControls.compositionSelectionMode}
              setSelectionMode={chartControls.setCompositionSelectionMode}
              selectionDate={chartControls.compositionSelectionDate}
              setSelectionDate={chartControls.setCompositionSelectionDate}
              idPrefix='portfolio'
            />

            <CompositionTabPanels
              translationKeyPrefix='portfolio.composition'
              snapshotLoading={snapshotLoading}
              snapshotError={snapshotError}
              snapshotEmpty={snapshotTop.length === 0}
              showSnapshotSkeleton={snapshotLoading && snapshotTop.length === 0}
              snapshotChart={
                <div className='h-[240px]'>
                  <CompositionSnapshotChart items={snapshotChartItems} />
                </div>
              }
              trendLoading={snapshotLoading || seriesLoading}
              trendError={snapshotError || seriesError}
              trendEmpty={series.length === 0}
              showTrendSkeleton={
                (snapshotLoading || seriesLoading) && series.length === 0
              }
              trendChart={
                <div className='h-[240px]'>
                  <CompositionSeriesChart series={series} variant='line' />
                </div>
              }
              stackedChart={
                <div className='h-[240px]'>
                  <CompositionSeriesChart
                    series={series}
                    variant='stacked'
                    includeOther
                  />
                </div>
              }
              snapshotClassName='min-h-[240px]'
              trendClassName='min-h-[240px]'
              stackedClassName='min-h-[240px]'
              snapshotSkeletonClassName='h-[240px] min-h-0'
              trendSkeletonClassName='h-[240px] min-h-0'
            />
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
