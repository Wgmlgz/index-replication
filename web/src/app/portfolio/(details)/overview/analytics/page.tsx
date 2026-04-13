'use client';

import { useEffect, useMemo, useState } from 'react';
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
  type PriceVisualizationSeries,
} from '@/components/charts-new/visualization';
import type {
  CompositionDataControls,
  PriceDataControls,
} from '@/components/charts-new/types/controls';
import {
  ButtonToggleGroup,
  type ButtonToggleGroupOption,
} from '@/components/ui/button-toggle-group';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type {
  CompositionDisplayTab,
  CompositionSourceMode,
  PortfolioPriceMode,
} from '@/app/portfolio/components/analytics/types';
import {
  normalizeLineSeriesFrom,
  resolveLatestTradeDate,
  resolveNormalizationStart,
  toLineData,
} from '@/app/portfolio/components/analytics/utils';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';

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

const formatSignedNumber = (
  formatter: Intl.NumberFormat,
  value: number,
): string => {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatter.format(value)}`;
};

const EMPTY_PROVIDER: ChartsDataProvider = {
  id: 'portfolio:none',
  cache: {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    persist: false,
  },
  getPriceHistory: () => Promise.resolve([]),
  getCompositionSnapshot: () => Promise.resolve([]),
  getCompositionSeries: () => Promise.resolve({}),
};

export default function PortfolioAnalyticsPage() {
  const { t } = useTranslation();
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();
  const benchmarkSecid = selectedProfile?.replication?.is_enabled
    ? selectedProfile.replication.benchmark_secid
    : null;
  const portfolioName = selectedProfile?.name || '';
  const portfolioID = selectedPortfolioID;
  const controls = useChartsNewControls({
    defaults: {
      price: DEFAULT_PRICE_CONTROLS,
      composition: DEFAULT_COMPOSITION_CONTROLS,
    },
  });

  const [priceMode, setPriceMode] = useState<PortfolioPriceMode>('compare');
  const [compositionSource, setCompositionSource] =
    useState<CompositionSourceMode>('portfolio');
  const [compositionDisplayTab, setCompositionDisplayTab] =
    useState<CompositionDisplayTab>(controls.composition.compositionTab);

  const chartType = controls.price.chartType;
  const setPriceField = controls.setPriceField;

  useEffect(() => {
    if (chartType === 'line') return;
    setPriceField('chartType', 'line');
  }, [chartType, setPriceField]);

  useEffect(() => {
    if (priceMode !== 'compare') return;
    if (controls.price.viewMode === 'price') return;
    setPriceField('viewMode', 'price');
  }, [controls.price.viewMode, priceMode, setPriceField]);

  const compositionTab = controls.composition.compositionTab;
  const setCompositionField = controls.setCompositionField;

  useEffect(() => {
    if (compositionTab === compositionDisplayTab) return;
    setCompositionField('compositionTab', compositionDisplayTab);
  }, [compositionDisplayTab, compositionTab, setCompositionField]);

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
  const hasBenchmark = Boolean(selectedBenchmark);

  const compositionSourceMode: CompositionSourceMode = hasBenchmark
    ? compositionSource
    : 'portfolio';

  const compositionDisplayTabOptions = useMemo<
    ButtonToggleGroupOption<CompositionDisplayTab>[]
  >(
    () => [
      {
        value: 'snapshot',
        label: t('portfolio.composition.tabs.snapshot'),
        content: t('portfolio.composition.tabs.snapshot'),
      },
      {
        value: 'trend',
        label: t('portfolio.composition.tabs.trend'),
        content: t('portfolio.composition.tabs.trend'),
      },
      {
        value: 'stacked',
        label: t('portfolio.composition.tabs.stacked'),
        content: t('portfolio.composition.tabs.stacked'),
      },
    ],
    [t],
  );

  const priceModeOptions = useMemo<ButtonToggleGroupOption<PortfolioPriceMode>[]>(
    () => [
      {
        value: 'portfolio',
        label: t('portfolio.chart.mode.portfolio'),
        content: t('portfolio.chart.mode.portfolio'),
      },
      {
        value: 'index',
        label: t('portfolio.chart.mode.index'),
        content: t('portfolio.chart.mode.index'),
      },
      {
        value: 'compare',
        label: t('portfolio.chart.mode.compare'),
        content: t('portfolio.chart.mode.compare'),
      },
    ],
    [t],
  );

  const priceSeries = useMemo<PriceVisualizationSeries[]>(() => {
    const portfolioData = toLineData(priceState.data);
    const benchmarkData = toLineData(benchmarkPriceState.data);
    const portfolioSeries: PriceVisualizationSeries = {
      id: 'portfolio',
      type: 'line',
      data: portfolioData,
      options: {
        color: '#2563eb',
        lineWidth: 2,
      },
    };

    const benchmarkSeries: PriceVisualizationSeries | null =
      selectedBenchmark && benchmarkData.length > 0
        ? {
            id: `benchmark:${selectedBenchmark.secid}`,
            type: 'line',
            data: benchmarkData,
            options: {
              color: '#f59e0b',
              lineWidth: 2,
            },
          }
        : null;

    if (priceMode === 'portfolio') {
      return [portfolioSeries];
    }
    if (priceMode === 'index') {
      return benchmarkSeries ? [benchmarkSeries] : [];
    }
    if (!benchmarkSeries) {
      return [];
    }

    const normalizationStart = resolveNormalizationStart(
      portfolioData,
      benchmarkData,
    );
    if (!normalizationStart) {
      return [];
    }

    const normalizedPortfolio = normalizeLineSeriesFrom(
      portfolioData,
      normalizationStart,
    );
    const normalizedBenchmark = normalizeLineSeriesFrom(
      benchmarkData,
      normalizationStart,
    );
    if (normalizedPortfolio.length === 0 || normalizedBenchmark.length === 0) {
      return [];
    }

    return [
      {
        ...portfolioSeries,
        data: normalizedPortfolio,
      },
      {
        ...benchmarkSeries,
        data: normalizedBenchmark,
      },
    ];
  }, [
    benchmarkPriceState.data,
    priceMode,
    priceState.data,
    selectedBenchmark,
  ]);

  const chartNoDataMessage = useMemo(() => {
    if ((priceMode === 'index' || priceMode === 'compare') && !hasBenchmark) {
      return t('portfolio.chart.noBenchmark');
    }
    return t('portfolio.chart.noData');
  }, [hasBenchmark, priceMode, t]);

  const chartLoading =
    priceMode === 'portfolio'
      ? priceState.loading
      : priceMode === 'index'
        ? benchmarkPriceState.loading
        : priceState.loading || benchmarkPriceState.loading;

  const chartHasError =
    priceMode === 'portfolio'
      ? priceState.error
      : priceMode === 'index'
        ? benchmarkPriceState.error
        : priceState.error || benchmarkPriceState.error;

  const selectedBenchmarkForComposition = useMemo<MoexIndex | null>(() => {
    if (!selectedBenchmark) {
      return null;
    }

    return {
      ...selectedBenchmark,
      hasComposition: true,
    };
  }, [selectedBenchmark]);

  const benchmarkLatestTradeDate = useMemo(
    () => resolveLatestTradeDate(benchmarkPriceState.data),
    [benchmarkPriceState.data],
  );

  const compositionSourceOptions = useMemo<
    ButtonToggleGroupOption<CompositionSourceMode>[]
  >(
    () => [
      {
        value: 'portfolio',
        label: t('portfolio.composition.source.portfolio'),
        content: t('portfolio.composition.source.portfolio'),
      },
      {
        value: 'index',
        label: t('portfolio.composition.source.index'),
        content: t('portfolio.composition.source.index'),
      },
    ],
    [t],
  );

  const portfolioCompositionState = useCompositionVisualizationData({
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

  const indexCompositionState = useCompositionVisualizationData({
    selectedIndex: selectedBenchmarkForComposition,
    latestTradeDate: benchmarkLatestTradeDate,
    baseRange: {
      rangeKey: controls.price.rangeKey,
      intervalKey: controls.price.intervalKey,
      customFrom: controls.price.customFrom,
      customTill: controls.price.customTill,
    },
    controls: controls.composition,
    provider: moexProvider,
  });

  const activeCompositionState =
    compositionSourceMode === 'index'
      ? indexCompositionState
      : portfolioCompositionState;

  const snapshotItems = useMemo(() => {
    if (controls.composition.topCount === null) {
      return activeCompositionState.snapshotItems;
    }
    return activeCompositionState.snapshotItems.slice(
      0,
      controls.composition.topCount,
    );
  }, [activeCompositionState.snapshotItems, controls.composition.topCount]);

  const legendRows = useMemo(
    () =>
      buildCompositionLegendRows(
        activeCompositionState.series,
        activeCompositionState.snapshotItems,
      ),
    [activeCompositionState.series, activeCompositionState.snapshotItems],
  );

  const snapshotOtherWeight = useMemo(
    () => calculateSnapshotOtherWeight(snapshotItems),
    [snapshotItems],
  );

  const trendLoading =
    activeCompositionState.snapshotLoading || activeCompositionState.seriesLoading;
  const trendError =
    activeCompositionState.snapshotError || activeCompositionState.seriesError;

  const compositionNoDataMessage = useMemo(() => {
    if (compositionSourceMode === 'index' && !hasBenchmark) {
      return t('portfolio.composition.noBenchmark');
    }
    return t('portfolio.composition.noData');
  }, [compositionSourceMode, hasBenchmark, t]);

  const compositionNoSeriesMessage = useMemo(() => {
    if (compositionSourceMode === 'index' && !hasBenchmark) {
      return t('portfolio.composition.noBenchmark');
    }
    return t('portfolio.composition.noSeries');
  }, [compositionSourceMode, hasBenchmark, t]);

  const showOtherLegend =
    (controls.composition.compositionTab === 'stacked' ||
      controls.composition.compositionTab === 'snapshot') &&
    snapshotOtherWeight > 0.01;

  const compositionChart =
    controls.composition.compositionTab === 'snapshot' ? (
      <CompositionSnapshotVisualization
        loading={activeCompositionState.snapshotLoading}
        hasError={activeCompositionState.snapshotError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={compositionNoDataMessage}
        items={snapshotItems}
        className='min-h-[200px] h-full min-w-0 w-full overflow-hidden'
      />
    ) : controls.composition.compositionTab === 'stacked' ? (
      <CompositionStackedVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={compositionNoSeriesMessage}
        series={activeCompositionState.series}
        rangeFrom={activeCompositionState.dateRange.from}
        rangeTill={activeCompositionState.dateRange.till}
        className='min-h-[200px] h-full min-w-0 w-full overflow-hidden'
      />
    ) : (
      <CompositionTrendVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={compositionNoSeriesMessage}
        series={activeCompositionState.series}
        rangeFrom={activeCompositionState.dateRange.from}
        rangeTill={activeCompositionState.dateRange.till}
        className='min-h-[200px] h-full min-w-0 w-full overflow-hidden'
      />
    );

  const priceSettings = (
    <>
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

      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-xs text-muted-foreground'>
          {t('portfolio.chart.mode.label')}
        </span>
        <ButtonToggleGroup
          value={priceMode}
          options={priceModeOptions}
          onValueChange={setPriceMode}
        />
      </div>
    </>
  );

  const compositionConstituents = (
    <>
      <div className='space-y-1'>
        <CardTitle>{t('portfolio.composition.title')}</CardTitle>
        {activeCompositionState.snapshotDate && (
          <div className='text-xs text-muted-foreground'>
            {t('portfolio.composition.asOf', {
              date: activeCompositionState.snapshotDate,
            })}
          </div>
        )}
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto pr-2'>
        <CompositionLegend
          rows={legendRows}
          loading={trendLoading}
          hasError={trendError}
          errorMessage={t('portfolio.composition.error')}
          noDataMessage={compositionNoSeriesMessage}
          translationKeyPrefix='portfolio.composition'
          showOther={showOtherLegend}
          otherWeight={snapshotOtherWeight}
          linkBuilder={() => undefined}
        />
      </div>
    </>
  );

  const compositionSettings = (
    <>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-xs text-muted-foreground'>
          {t('portfolio.composition.tabs.label')}
        </span>
        <ButtonToggleGroup
          value={compositionDisplayTab}
          options={compositionDisplayTabOptions}
          onValueChange={setCompositionDisplayTab}
        />
      </div>

      {hasBenchmark && (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted-foreground'>
            {t('portfolio.composition.source.label')}
          </span>
          <ButtonToggleGroup
            value={compositionSourceMode}
            options={compositionSourceOptions}
            onValueChange={setCompositionSource}
          />
        </div>
      )}

      <CompositionControlsPanel
        controls={controls.composition}
        actions={controls.compositionActions}
        translationKeyPrefix='portfolio.composition'
        idPrefix='portfolio'
        topCountOptions={TOP_COUNT_OPTIONS}
        hideTabs
      />
    </>
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
      <CardContent className='flex h-full min-h-0 flex-col gap-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]'>
        <div className='flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1'>
          {priceSettings}
        </div>

        <PriceVisualization
          loading={chartLoading}
          hasError={chartHasError && priceSeries[0]?.data.length === 0}
          errorMessage={t('portfolio.chart.error')}
          noDataMessage={chartNoDataMessage}
          series={priceSeries}
          visibleRange={priceState.dateRange}
          className='flex min-h-[200px] min-w-0 flex-1 items-stretch overflow-hidden lg:col-start-2 lg:row-start-1 lg:row-span-2'
        />

        <div className='flex min-h-0 min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-2 lg:row-span-3'>
          {compositionConstituents}
        </div>

        <div className='flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-3'>
          {compositionSettings}
        </div>

        <div className='flex min-h-[200px] min-w-0 flex-1 flex-col lg:col-start-2 lg:row-start-4'>
          {compositionChart}
        </div>
      </CardContent>
    </Card>
  );
}
