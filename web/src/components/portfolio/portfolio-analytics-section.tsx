'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { MoexIndex } from '@/api-client';
import { useTranslation } from 'react-i18next';
import { useTBankConnectionContext } from '@/components/tbank-test/tbank-connection-context';
import {
  buildCompositionLegendRows,
  calculateSnapshotOtherWeight,
  createTbankChartsDataProvider,
  useCompositionVisualizationData,
  usePriceVisualizationData,
} from '@/components/charts-new/data';
import {
  CompositionControlsPanel,
  PriceControlsPanel,
  useChartsNewControls,
} from '@/components/charts-new/controls';
import {
  CompositionLegend,
  CompositionSnapshotVisualization,
  CompositionStackedVisualization,
  CompositionTrendVisualization,
  PriceVisualization,
  type PriceChartData,
} from '@/components/charts-new/visualization';
import type {
  CompositionDataControls,
  PriceDataControls,
} from '@/components/charts-new/types/controls';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useUrlStateSync } from '@/lib/url-state/use-url-state-sync';

const PORTFOLIO_ACCOUNT_KEY = 'cn_acc';
const LEGACY_PORTFOLIO_URL_KEYS = [
  'acc',
  'r',
  'i',
  'f',
  't',
  'v',
  'ctab',
  'cmode',
  'cdate',
  'top',
] as const;

const DEFAULT_PRICE_CONTROLS: Partial<PriceDataControls> = {
  rangeKey: '1y',
  intervalKey: 'auto',
  viewMode: 'price',
  chartType: 'line',
};

const DEFAULT_COMPOSITION_CONTROLS: Partial<CompositionDataControls> = {
  compositionSelectionMode: 'fixed',
  compositionSelectionDate: '',
  compositionTab: 'snapshot',
  topCount: 10,
};

const TOP_COUNT_OPTIONS = [5, 10, 20, 50];

const parsePortfolioUrlState = (searchParams: URLSearchParams) => {
  const accountID = searchParams.get(PORTFOLIO_ACCOUNT_KEY)?.trim();
  return {
    accountID: accountID && accountID.length > 0 ? accountID : undefined,
  };
};

const resolveLatestTradeDate = (data: PriceChartData): string | null => {
  if (data.length === 0) return null;
  const lastPoint = data[data.length - 1];
  if (!lastPoint || typeof lastPoint.time !== 'string') return null;
  return lastPoint.time.length > 0 ? lastPoint.time : null;
};

const formatSignedNumber = (
  formatter: Intl.NumberFormat,
  value: number
): string => {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatter.format(value)}`;
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
  const controls = useChartsNewControls({
    defaults: {
      price: DEFAULT_PRICE_CONTROLS,
      composition: DEFAULT_COMPOSITION_CONTROLS,
    },
  });
  const portfolioChartType = controls.price.chartType;
  const setPriceField = controls.setPriceField;

  // Portfolio history endpoint has no OHLC values, so enforce line chart.
  useEffect(() => {
    if (portfolioChartType === 'line') return;
    setPriceField('chartType', 'line');
  }, [portfolioChartType, setPriceField]);

  const accountUrlStateKey = useMemo(
    () =>
      JSON.stringify({
        accountID,
        controls: {
          price: controls.price,
          composition: controls.composition,
        },
      }),
    [accountID, controls.composition, controls.price]
  );

  useUrlStateSync({
    pathname,
    urlKey,
    stateKey: accountUrlStateKey,
    parse: parsePortfolioUrlState,
    applyParsedState: next => {
      setAccountID(next.accountID ?? '');
    },
    buildSearchParams: () => {
      const next = new URLSearchParams(window.location.search);
      LEGACY_PORTFOLIO_URL_KEYS.forEach(key => next.delete(key));
      next.delete(PORTFOLIO_ACCOUNT_KEY);

      const accountValue = accountID.trim();
      if (accountValue.length > 0) {
        next.set(PORTFOLIO_ACCOUNT_KEY, accountValue);
      }

      return next;
    },
  });

  const resolvedAccountID = accountID || status?.default_account_id || '';
  const selectedPortfolio = useMemo<MoexIndex | null>(() => {
    if (!resolvedAccountID) return null;
    return {
      secid: resolvedAccountID,
      name: resolvedAccountID,
      shortName: resolvedAccountID,
      currency: '',
      decimals: 2,
      hasComposition: true,
    };
  }, [resolvedAccountID]);

  const provider = useMemo(() => createTbankChartsDataProvider(), []);
  const priceState = usePriceVisualizationData(
    selectedPortfolio,
    controls.price,
    provider
  );
  const latestTradeDate = useMemo(
    () => resolveLatestTradeDate(priceState.data),
    [priceState.data]
  );

  const compositionState = useCompositionVisualizationData({
    selectedIndex: selectedPortfolio,
    latestTradeDate,
    baseRange: {
      rangeKey: controls.price.rangeKey,
      intervalKey: controls.price.intervalKey,
      customFrom: controls.price.customFrom,
      customTill: controls.price.customTill,
    },
    controls: controls.composition,
    provider,
  });

  const snapshotItems = useMemo(() => {
    if (controls.composition.topCount === null) {
      return compositionState.snapshotItems;
    }
    return compositionState.snapshotItems.slice(0, controls.composition.topCount);
  }, [compositionState.snapshotItems, controls.composition.topCount]);
  const legendRows = useMemo(
    () =>
      buildCompositionLegendRows(
        compositionState.series,
        compositionState.snapshotItems
      ),
    [compositionState.series, compositionState.snapshotItems]
  );
  const snapshotOtherWeight = useMemo(
    () => calculateSnapshotOtherWeight(snapshotItems),
    [snapshotItems]
  );

  const trendLoading =
    compositionState.snapshotLoading || compositionState.seriesLoading;
  const trendError = compositionState.snapshotError || compositionState.seriesError;
  const showOtherLegend =
    (controls.composition.compositionTab === 'stacked' ||
      controls.composition.compositionTab === 'snapshot') &&
    snapshotOtherWeight > 0.01;

  const compositionChart =
    controls.composition.compositionTab === 'snapshot' ? (
      <CompositionSnapshotVisualization
        loading={compositionState.snapshotLoading}
        hasError={compositionState.snapshotError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={t('portfolio.composition.noData')}
        items={snapshotItems}
        className='min-h-[200px] h-full'
      />
    ) : controls.composition.compositionTab === 'stacked' ? (
      <CompositionStackedVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={t('portfolio.composition.noSeries')}
        series={compositionState.series}
        className='min-h-[200px] h-full'
      />
    ) : (
      <CompositionTrendVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={t('portfolio.composition.noSeries')}
        series={compositionState.series}
        className='min-h-[200px] h-full'
      />
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
    <Card className='h-full min-h-0'>
      <CardHeader>
        <CardTitle>{t('portfolio.analytics.title')}</CardTitle>
        <CardDescription>{t('portfolio.analytics.description')}</CardDescription>
      </CardHeader>
      <CardContent className='grid h-full min-h-0 gap-4 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]'>
        <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
          <div className='flex flex-col gap-3 lg:w-[320px]'>
            <div className='grid gap-2'>
              <Label htmlFor='portfolio-analytics-account'>
                {t('portfolio.analytics.accountLabel')}
              </Label>
              <select
                id='portfolio-analytics-account'
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={accountID}
                onChange={event => setAccountID(event.target.value)}
              >
                <option value=''>
                  {t('portfolio.analytics.accountDefaultOption')}
                </option>
                {(availableAccounts ?? []).map(account => (
                  <option key={account.id} value={account.id}>
                    {account.id}
                  </option>
                ))}
              </select>
            </div>

            {priceState.latestValue !== null && (
              <div className='text-sm'>
                <span className='font-medium'>
                  {priceState.numberFormatter.format(priceState.latestValue)}
                </span>
                {priceState.currency ? ` ${priceState.currency}` : ''}
                {priceState.change !== null && priceState.changePercent !== null && (
                  <span
                    className={`ml-2 font-medium ${
                      priceState.change > 0
                        ? 'text-emerald-600'
                        : priceState.change < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {formatSignedNumber(priceState.numberFormatter, priceState.change)} (
                    {priceState.change > 0 ? '+' : ''}
                    {priceState.changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}

            <PriceControlsPanel
              controls={controls.price}
              actions={controls.priceActions}
              translationKeyPrefix='portfolio.chart'
              idPrefix='portfolio'
              hideChartType
            />
          </div>

          <PriceVisualization
            loading={priceState.loading}
            hasError={priceState.error}
            errorMessage={t('portfolio.chart.error')}
            noDataMessage={t('portfolio.chart.noData')}
            data={priceState.data}
            seriesType='line'
            className='flex min-h-[200px] flex-1 items-stretch'
          />
        </div>

        <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
          <div className='flex min-h-0 flex-col gap-3 lg:w-[320px]'>
            <div className='space-y-1'>
              <CardTitle>{t('portfolio.composition.title')}</CardTitle>
              {compositionState.snapshotDate && (
                <div className='text-xs text-muted-foreground'>
                  {t('portfolio.composition.asOf', {
                    date: compositionState.snapshotDate,
                  })}
                </div>
              )}
            </div>

            <CompositionControlsPanel
              controls={controls.composition}
              actions={controls.compositionActions}
              translationKeyPrefix='portfolio.composition'
              idPrefix='portfolio'
              topCountOptions={TOP_COUNT_OPTIONS}
            />

            <div className='min-h-0 flex-1 overflow-y-auto pr-2'>
              <CompositionLegend
                rows={legendRows}
                loading={trendLoading}
                hasError={trendError}
                errorMessage={t('portfolio.composition.error')}
                noDataMessage={t('portfolio.composition.noSeries')}
                translationKeyPrefix='portfolio.composition'
                showOther={showOtherLegend}
                otherWeight={snapshotOtherWeight}
                linkBuilder={() => undefined}
              />
            </div>
          </div>

          <div className='flex min-h-[200px] flex-1 flex-col'>{compositionChart}</div>
        </div>
      </CardContent>
    </Card>
  );
}
