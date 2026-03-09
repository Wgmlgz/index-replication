'use client';

import { useEffect, useMemo } from 'react';
import type { MoexIndex } from '@/api-client';
import { useTranslation } from 'react-i18next';
import {
  buildCompositionLegendRows,
  calculateSnapshotOtherWeight,
  createMoexChartsDataProvider,
  createPortfolioChartsDataProvider,
  useCompositionVisualizationData,
  usePriceVisualizationData,
  type ChartsDataProvider,
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
  type PriceLinePoint,
  type PriceVisualizationSeries,
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

const EMPTY_PROVIDER: ChartsDataProvider = {
  id: 'portfolio:none',
  getPriceHistory: () => Promise.resolve([]),
  getCompositionSnapshot: () => Promise.resolve([]),
  getCompositionSeries: () => Promise.resolve({}),
};

const resolveLatestTradeDate = (data: PriceChartData): string | null => {
  if (data.length === 0) return null;
  const lastPoint = data[data.length - 1];
  if (!lastPoint || typeof lastPoint.time !== 'string') return null;
  return lastPoint.time.length > 0 ? lastPoint.time : null;
};

const toLineData = (data: PriceChartData): PriceLinePoint[] => {
  return data.map(point => ({
    time: point.time,
    value: 'value' in point ? point.value : point.close,
  }));
};

const formatSignedNumber = (
  formatter: Intl.NumberFormat,
  value: number,
): string => {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatter.format(value)}`;
};

type PortfolioAnalyticsSectionProps = {
  portfolioID: number | null;
  portfolioName: string;
  benchmarkSecid?: string | null;
};

export function PortfolioAnalyticsSection({
  portfolioID,
  portfolioName,
  benchmarkSecid = null,
}: PortfolioAnalyticsSectionProps) {
  const { t } = useTranslation();
  const controls = useChartsNewControls({
    defaults: {
      price: DEFAULT_PRICE_CONTROLS,
      composition: DEFAULT_COMPOSITION_CONTROLS,
    },
  });

  const chartType = controls.price.chartType;
  const setPriceField = controls.setPriceField;

  useEffect(() => {
    if (chartType === 'line') return;
    setPriceField('chartType', 'line');
  }, [chartType, setPriceField]);

  const selectedPortfolio = useMemo<MoexIndex | null>(() => {
    if (!portfolioID) return null;
    const secid = String(portfolioID);
    return {
      secid,
      name: portfolioName || secid,
      shortName: portfolioName || secid,
      currency: '',
      decimals: 2,
      hasComposition: true,
    };
  }, [portfolioID, portfolioName]);

  const provider = useMemo(
    () =>
      portfolioID
        ? createPortfolioChartsDataProvider(portfolioID)
        : EMPTY_PROVIDER,
    [portfolioID],
  );
  const moexProvider = useMemo(() => createMoexChartsDataProvider(), []);

  const priceState = usePriceVisualizationData(
    selectedPortfolio,
    controls.price,
    provider,
  );
  const selectedBenchmark = useMemo<MoexIndex | null>(() => {
    const secid = benchmarkSecid?.trim();
    if (!secid) {
      return null;
    }

    return {
      secid,
      name: secid,
      shortName: secid,
      currency: '',
      decimals: 2,
      hasComposition: false,
    };
  }, [benchmarkSecid]);
  const benchmarkPriceState = usePriceVisualizationData(
    selectedBenchmark,
    controls.price,
    moexProvider,
  );
  const latestTradeDate = useMemo(
    () => resolveLatestTradeDate(priceState.data),
    [priceState.data],
  );
  const priceSeries = useMemo<PriceVisualizationSeries[]>(() => {
    const series: PriceVisualizationSeries[] = [
      {
        id: 'portfolio',
        type: 'line',
        data: toLineData(priceState.data),
        options: {
          color: '#2563eb',
          lineWidth: 2,
        },
      },
    ];

    if (selectedBenchmark) {
      const benchmarkData = toLineData(benchmarkPriceState.data);
      if (benchmarkData.length > 0) {
        series.push({
          id: `benchmark:${selectedBenchmark.secid}`,
          type: 'line',
          data: benchmarkData,
          options: {
            color: '#f59e0b',
            lineWidth: 2,
          },
        });
      }
    }

    return series;
  }, [benchmarkPriceState.data, priceState.data, selectedBenchmark]);

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
    return compositionState.snapshotItems.slice(
      0,
      controls.composition.topCount,
    );
  }, [compositionState.snapshotItems, controls.composition.topCount]);

  const legendRows = useMemo(
    () =>
      buildCompositionLegendRows(
        compositionState.series,
        compositionState.snapshotItems,
      ),
    [compositionState.series, compositionState.snapshotItems],
  );

  const snapshotOtherWeight = useMemo(
    () => calculateSnapshotOtherWeight(snapshotItems),
    [snapshotItems],
  );

  const trendLoading =
    compositionState.snapshotLoading || compositionState.seriesLoading;
  const trendError =
    compositionState.snapshotError || compositionState.seriesError;
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
        className='min-h-[200px] h-full min-w-0 w-full overflow-hidden'
      />
    ) : controls.composition.compositionTab === 'stacked' ? (
      <CompositionStackedVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={t('portfolio.composition.noSeries')}
        series={compositionState.series}
        className='min-h-[200px] h-full min-w-0 w-full overflow-hidden'
      />
    ) : (
      <CompositionTrendVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={t('portfolio.composition.noSeries')}
        series={compositionState.series}
        className='min-h-[200px] h-full min-w-0 w-full overflow-hidden'
      />
    );

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.analytics.title')}</CardTitle>
          <CardDescription>
            {t('portfolio.analytics.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.analytics.selectPrompt')}
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
        <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row'>
          <div className='flex min-w-0 flex-col gap-3 lg:w-[320px]'>
            {priceState.latestValue !== null && (
              <div className='text-sm'>
                <span className='font-medium'>
                  {priceState.numberFormatter.format(priceState.latestValue)}
                </span>
                {priceState.currency ? ` ${priceState.currency}` : ''}
                {priceState.change !== null &&
                  priceState.changePercent !== null && (
                    <span
                      className={`ml-2 font-medium ${
                        priceState.change > 0
                          ? 'text-emerald-600'
                          : priceState.change < 0
                            ? 'text-red-600'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {formatSignedNumber(
                        priceState.numberFormatter,
                        priceState.change,
                      )}{' '}
                      ({priceState.change > 0 ? '+' : ''}
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
            hasError={priceState.error && priceSeries[0]?.data.length === 0}
            errorMessage={t('portfolio.chart.error')}
            noDataMessage={t('portfolio.chart.noData')}
            series={priceSeries}
            className='flex min-h-[200px] min-w-0 flex-1 items-stretch overflow-hidden'
          />
        </div>

        <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row'>
          <div className='flex min-h-0 min-w-0 flex-col gap-3 lg:w-[320px]'>
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

          {compositionChart}
        </div>
      </CardContent>
    </Card>
  );
}
