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
  type CompositionSnapshotItem,
  type PriceChartData,
  type PriceLinePoint,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

const normalizeLineSeriesFrom = (
  data: PriceLinePoint[],
  startTime: string,
): PriceLinePoint[] => {
  const startIndex = data.findIndex(point => point.time >= startTime);
  if (startIndex < 0) {
    return [];
  }

  const baseValue = data[startIndex]?.value ?? 0;
  if (baseValue <= 0) {
    return [];
  }

  return data.slice(startIndex).map(point => ({
    time: point.time,
    value: (point.value / baseValue) * 100,
  }));
};

const resolveNormalizationStart = (
  portfolioData: PriceLinePoint[],
  benchmarkData: PriceLinePoint[],
): string | null => {
  if (portfolioData.length === 0 || benchmarkData.length === 0) {
    return null;
  }

  const benchmarkByTime = new Map(benchmarkData.map(point => [point.time, point.value]));
  for (const point of portfolioData) {
    const benchmarkValue = benchmarkByTime.get(point.time);
    if (!benchmarkValue) {
      continue;
    }
    if (point.value > 0 && benchmarkValue > 0) {
      return point.time;
    }
  }

  const commonStart = portfolioData[0]?.time;
  const benchmarkStart = benchmarkData[0]?.time;
  if (!commonStart || !benchmarkStart) {
    return null;
  }

  return commonStart > benchmarkStart ? commonStart : benchmarkStart;
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

type PortfolioPriceMode = 'portfolio' | 'index' | 'compare';
type CompositionSourceMode = 'portfolio' | 'index';
type CompositionDisplayTab = 'snapshot' | 'trend' | 'stacked' | 'compare';
type CompositionCompareRow = {
  key: string;
  ticker: string;
  name: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  activeWeight: number;
  absActive: number;
  contributionPct: number;
  status:
    | 'overweight'
    | 'underweight'
    | 'neutral'
    | 'portfolio_only'
    | 'benchmark_only';
};

function resolveSnapshotKey(item: CompositionSnapshotItem): string {
  const ticker = item.ticker.trim();
  if (ticker.length > 0) return ticker;
  return item.secId.trim();
}

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
    if (compositionDisplayTab === 'compare') return;
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
      {
        value: 'compare',
        label: t('portfolio.composition.tabs.compare'),
        content: t('portfolio.composition.tabs.compare'),
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
  const compareRows = useMemo<CompositionCompareRow[]>(() => {
    if (!hasBenchmark) {
      return [];
    }

    const portfolioByKey = new Map(
      portfolioCompositionState.snapshotItems.map(item => [
        resolveSnapshotKey(item),
        item,
      ]),
    );
    const benchmarkByKey = new Map(
      indexCompositionState.snapshotItems.map(item => [
        resolveSnapshotKey(item),
        item,
      ]),
    );
    const keys = new Set<string>([
      ...portfolioByKey.keys(),
      ...benchmarkByKey.keys(),
    ]);

    const baseRows: Omit<CompositionCompareRow, 'contributionPct'>[] = [];
    let totalSquaredError = 0;
    for (const key of keys) {
      if (!key) continue;
      const portfolioItem = portfolioByKey.get(key);
      const benchmarkItem = benchmarkByKey.get(key);
      const portfolioWeight = portfolioItem?.weight ?? 0;
      const benchmarkWeight = benchmarkItem?.weight ?? 0;
      const activeWeight = portfolioWeight - benchmarkWeight;
      const absActive = Math.abs(activeWeight);
      totalSquaredError += activeWeight * activeWeight;

      const status: CompositionCompareRow['status'] =
        portfolioWeight > 0 && benchmarkWeight === 0
          ? 'portfolio_only'
          : benchmarkWeight > 0 && portfolioWeight === 0
            ? 'benchmark_only'
            : activeWeight > 0
              ? 'overweight'
              : activeWeight < 0
                ? 'underweight'
                : 'neutral';

      baseRows.push({
        key,
        ticker: portfolioItem?.ticker || benchmarkItem?.ticker || key,
        name: portfolioItem?.name || benchmarkItem?.name || key,
        portfolioWeight,
        benchmarkWeight,
        activeWeight,
        absActive,
        status,
      });
    }

    return baseRows
      .map(row => ({
        ...row,
        contributionPct:
          totalSquaredError > 0
            ? (row.activeWeight * row.activeWeight * 100) / totalSquaredError
            : 0,
      }))
      .sort((a, b) => b.absActive - a.absActive);
  }, [
    hasBenchmark,
    indexCompositionState.snapshotItems,
    portfolioCompositionState.snapshotItems,
  ]);
  const compareSummary = useMemo(() => {
    let squaredErrorSum = 0;
    let absActiveSum = 0;
    let overlapSum = 0;
    let overweightCount = 0;
    let underweightCount = 0;
    let portfolioOnlyCount = 0;
    let benchmarkOnlyCount = 0;

    for (const row of compareRows) {
      squaredErrorSum += row.activeWeight * row.activeWeight;
      absActiveSum += row.absActive;
      overlapSum += Math.min(row.portfolioWeight, row.benchmarkWeight);
      if (row.status === 'overweight') overweightCount += 1;
      if (row.status === 'underweight') underweightCount += 1;
      if (row.status === 'portfolio_only') portfolioOnlyCount += 1;
      if (row.status === 'benchmark_only') benchmarkOnlyCount += 1;
    }

    return {
      trackingError: Math.sqrt(squaredErrorSum),
      meanAbsActive: absActiveSum / 2,
      overlap: overlapSum,
      overweightCount,
      underweightCount,
      portfolioOnlyCount,
      benchmarkOnlyCount,
    };
  }, [compareRows]);
  const visibleCompareRows = useMemo(() => {
    if (controls.composition.topCount === null) {
      return compareRows;
    }
    return compareRows.slice(0, controls.composition.topCount);
  }, [compareRows, controls.composition.topCount]);
  const compareLoading =
    portfolioCompositionState.snapshotLoading || indexCompositionState.snapshotLoading;
  const compareError =
    portfolioCompositionState.snapshotError || indexCompositionState.snapshotError;
  const compareNoDataMessage = useMemo(() => {
    if (!hasBenchmark) {
      return t('portfolio.composition.noBenchmark');
    }
    return t('portfolio.composition.compare.noData');
  }, [hasBenchmark, t]);

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
        className='min-h-[200px] h-full min-w-0 w-full overflow-hidden'
      />
    ) : (
      <CompositionTrendVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('portfolio.composition.error')}
        noDataMessage={compositionNoSeriesMessage}
        series={activeCompositionState.series}
        className='min-h-[200px] h-full min-w-0 w-full overflow-hidden'
      />
    );
  const formatPercent = (value: number): string => `${value.toFixed(2)}%`;
  const formatStatus = (status: CompositionCompareRow['status']): string =>
    t(`portfolio.composition.compare.status.${status}`);

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
          </div>

          <PriceVisualization
            loading={chartLoading}
            hasError={chartHasError && priceSeries[0]?.data.length === 0}
            errorMessage={t('portfolio.chart.error')}
            noDataMessage={chartNoDataMessage}
            series={priceSeries}
            className='flex min-h-[200px] min-w-0 flex-1 items-stretch overflow-hidden'
          />
        </div>

        <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row'>
          <div className='flex min-h-0 min-w-0 flex-col gap-3 lg:w-[320px]'>
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

            <div className='min-h-0 flex-1 overflow-y-auto pr-2'>
              {compositionDisplayTab !== 'compare' ? (
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
              ) : null}
            </div>
          </div>

          {compositionDisplayTab !== 'compare' ? (
            compositionChart
          ) : (
            <div className='flex min-h-[200px] min-w-0 flex-1 flex-col gap-3 overflow-hidden'>
              {compareLoading && (
                <div className='text-sm text-muted-foreground'>
                  {t('portfolio.composition.compare.loading')}
                </div>
              )}
              {!compareLoading && compareError && (
                <div className='text-sm text-muted-foreground'>
                  {t('portfolio.composition.error')}
                </div>
              )}
              {!compareLoading && !compareError && visibleCompareRows.length === 0 && (
                <div className='text-sm text-muted-foreground'>
                  {compareNoDataMessage}
                </div>
              )}
              {!compareLoading && !compareError && visibleCompareRows.length > 0 && (
                <>
                  <div className='grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3'>
                    <div className='rounded border p-2'>
                      {t('portfolio.composition.compare.summary.trackingError')}:{' '}
                      <span className='font-medium text-foreground'>
                        {formatPercent(compareSummary.trackingError)}
                      </span>
                    </div>
                    <div className='rounded border p-2'>
                      {t('portfolio.composition.compare.summary.meanAbsActive')}:{' '}
                      <span className='font-medium text-foreground'>
                        {formatPercent(compareSummary.meanAbsActive)}
                      </span>
                    </div>
                    <div className='rounded border p-2'>
                      {t('portfolio.composition.compare.summary.overlap')}:{' '}
                      <span className='font-medium text-foreground'>
                        {formatPercent(compareSummary.overlap)}
                      </span>
                    </div>
                    <div className='rounded border p-2'>
                      {t('portfolio.composition.compare.summary.overweightCount')}:{' '}
                      <span className='font-medium text-foreground'>
                        {compareSummary.overweightCount}
                      </span>
                    </div>
                    <div className='rounded border p-2'>
                      {t('portfolio.composition.compare.summary.underweightCount')}:{' '}
                      <span className='font-medium text-foreground'>
                        {compareSummary.underweightCount}
                      </span>
                    </div>
                    <div className='rounded border p-2'>
                      {t('portfolio.composition.compare.summary.missingCount')}:{' '}
                      <span className='font-medium text-foreground'>
                        {compareSummary.portfolioOnlyCount + compareSummary.benchmarkOnlyCount}
                      </span>
                    </div>
                  </div>

                  <div className='min-h-0 flex-1 overflow-auto rounded border'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('portfolio.composition.compare.columns.ticker')}</TableHead>
                          <TableHead>{t('portfolio.composition.compare.columns.name')}</TableHead>
                          <TableHead className='text-right'>
                            {t('portfolio.composition.compare.columns.portfolioWeight')}
                          </TableHead>
                          <TableHead className='text-right'>
                            {t('portfolio.composition.compare.columns.benchmarkWeight')}
                          </TableHead>
                          <TableHead className='text-right'>
                            {t('portfolio.composition.compare.columns.activeWeight')}
                          </TableHead>
                          <TableHead className='text-right'>
                            {t('portfolio.composition.compare.columns.absActive')}
                          </TableHead>
                          <TableHead className='text-right'>
                            {t('portfolio.composition.compare.columns.errorContribution')}
                          </TableHead>
                          <TableHead>{t('portfolio.composition.compare.columns.status')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleCompareRows.map(row => (
                          <TableRow key={row.key}>
                            <TableCell className='font-medium'>{row.ticker}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className='text-right'>
                              {formatPercent(row.portfolioWeight)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatPercent(row.benchmarkWeight)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatPercent(row.activeWeight)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatPercent(row.absActive)}
                            </TableCell>
                            <TableCell className='text-right'>
                              {formatPercent(row.contributionPct)}
                            </TableCell>
                            <TableCell>{formatStatus(row.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
