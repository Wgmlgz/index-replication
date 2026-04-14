'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { useMoexIndexDetailContext } from '@/components/moex-indexes/detail/moex-indexes-detail-context';
import {
  buildCompositionLegendRows,
  calculateSnapshotOtherWeight,
  createMoexChartsDataProvider,
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
  type PriceCandlestickPoint,
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

const resolveLatestTradeDate = (data: PriceChartData): string | null => {
  if (data.length === 0) return null;
  const lastPoint = data[data.length - 1];
  if (!lastPoint || typeof lastPoint.time !== 'string') return null;
  return lastPoint.time.length > 0 ? lastPoint.time : null;
};

const buildPriceSeries = (
  data: PriceChartData,
  chartType: PriceDataControls['chartType']
): PriceVisualizationSeries[] => {
  if (chartType === 'candlestick') {
    return [
      {
        id: 'price',
        type: 'candlestick',
        data: data as PriceCandlestickPoint[],
      },
    ];
  }

  return [
    {
      id: 'price',
      type: 'line',
      data: data as PriceLinePoint[],
    },
  ];
};

const formatSignedNumber = (
  formatter: Intl.NumberFormat,
  value: number
): string => {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatter.format(value)}`;
};

export function MoexIndexesChartsPanel() {
  const { t } = useTranslation();
  const { selectedIndex } = useMoexIndexDetailContext();
  const dataProvider = useMemo(() => createMoexChartsDataProvider(), []);

  const controls = useChartsNewControls({
    defaults: {
      price: DEFAULT_PRICE_CONTROLS,
      composition: DEFAULT_COMPOSITION_CONTROLS,
    },
  });

  const priceState = usePriceVisualizationData(
    selectedIndex,
    controls.price,
    dataProvider
  );
  const priceSeries = useMemo(
    () => buildPriceSeries(priceState.data, controls.price.chartType),
    [controls.price.chartType, priceState.data]
  );
  const latestTradeDate = useMemo(
    () => resolveLatestTradeDate(priceState.data),
    [priceState.data]
  );

  const compositionState = useCompositionVisualizationData({
    selectedIndex,
    latestTradeDate,
    baseRange: {
      rangeKey: controls.price.rangeKey,
      intervalKey: controls.price.intervalKey,
      customFrom: controls.price.customFrom,
      customTill: controls.price.customTill,
    },
    controls: controls.composition,
    provider: dataProvider,
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

  const showComposition = Boolean(selectedIndex?.hasComposition);
  const trendLoading =
    compositionState.snapshotLoading || compositionState.seriesLoading;
  const trendError = compositionState.snapshotError || compositionState.seriesError;
  const showOtherLegend =
    (controls.composition.compositionTab === 'stacked' ||
      controls.composition.compositionTab === 'snapshot') &&
    snapshotOtherWeight > 0.01;

  const shouldShowAsOf = useMemo(() => {
    if (!compositionState.snapshotDate) return false;
    if (controls.composition.compositionSelectionMode === 'rolling') return true;
    const selectedDate = controls.composition.compositionSelectionDate.trim();
    if (!selectedDate) return true;
    return compositionState.snapshotDate !== selectedDate;
  }, [
    compositionState.snapshotDate,
    controls.composition.compositionSelectionDate,
    controls.composition.compositionSelectionMode,
  ]);

  const selectedSecid = selectedIndex?.secid ?? '';
  const compositionSourceLabel = selectedSecid
    ? t('moex.sources.indexConstituents', { secid: selectedSecid })
    : t('moex.sources.selectIndex');
  const compositionHref = selectedSecid
    ? moexSourceLinks.indexConstituents(selectedSecid)
    : undefined;

  const latestValueLine =
    priceState.latestValue === null ? null : (
      <div className='text-sm'>
        <span className='font-medium'>
          {priceState.numberFormatter.format(priceState.latestValue)}
        </span>
        {selectedIndex?.currency ? ` ${selectedIndex.currency}` : ''}
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
    );

  const compositionChart =
    controls.composition.compositionTab === 'snapshot' ? (
      <CompositionSnapshotVisualization
        loading={compositionState.snapshotLoading}
        hasError={compositionState.snapshotError}
        errorMessage={t('moex.composition.error')}
        noDataMessage={t('moex.composition.noData')}
        items={snapshotItems}
        className='min-h-[200px] h-full'
      />
    ) : controls.composition.compositionTab === 'stacked' ? (
      <CompositionStackedVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('moex.composition.error')}
        noDataMessage={t('moex.composition.noSeries')}
        series={compositionState.series}
        rangeFrom={compositionState.dateRange.from}
        rangeTill={compositionState.dateRange.till}
        className='min-h-[200px] h-full'
      />
    ) : (
      <CompositionTrendVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('moex.composition.error')}
        noDataMessage={t('moex.composition.noSeries')}
        series={compositionState.series}
        rangeFrom={compositionState.dateRange.from}
        rangeTill={compositionState.dateRange.till}
        className='min-h-[200px] h-full'
      />
    );
  const compositionTabOptions = useMemo<
    ButtonToggleGroupOption<CompositionDataControls['compositionTab']>[]
  >(
    () => [
      {
        value: 'snapshot',
        label: t('moex.composition.tabs.snapshot'),
        content: t('moex.composition.tabs.snapshot'),
      },
      {
        value: 'trend',
        label: t('moex.composition.tabs.trend'),
        content: t('moex.composition.tabs.trend'),
      },
      {
        value: 'stacked',
        label: t('moex.composition.tabs.stacked'),
        content: t('moex.composition.tabs.stacked'),
      },
    ],
    [t]
  );

  const priceSettings = (
    <>
      {latestValueLine}
      {priceState.loading && !latestValueLine && (
        <div className='flex items-center gap-2'>
          <Skeleton className='h-5 w-20' />
          <Skeleton className='h-5 w-16' />
        </div>
      )}
      <PriceControlsPanel
        controls={controls.price}
        actions={controls.priceActions}
        translationKeyPrefix='moex.chart'
        idPrefix='moex'
      />
    </>
  );

  if (!showComposition) {
    return (
      <div className='flex h-full min-h-0 flex-col gap-4 lg:flex-row'>
        <div className='flex flex-col gap-3 lg:w-[320px]'>{priceSettings}</div>
        <PriceVisualization
          loading={priceState.loading}
          hasError={priceState.error}
          errorMessage={t('moex.errors.history')}
          noDataMessage={t('moex.chart.noData')}
          series={priceSeries}
          visibleRange={priceState.dateRange}
          className='flex min-h-[200px] flex-1 items-stretch'
        />
      </div>
    );
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-4 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto_minmax(0,1fr)]'>
      <div className='flex flex-col gap-3 lg:col-start-1 lg:row-start-1'>
        {priceSettings}
      </div>

      <PriceVisualization
        loading={priceState.loading}
        hasError={priceState.error}
        errorMessage={t('moex.errors.history')}
        noDataMessage={t('moex.chart.noData')}
        series={priceSeries}
        visibleRange={priceState.dateRange}
        className='flex min-h-[200px] flex-1 items-stretch lg:col-start-2 lg:row-start-1 lg:row-span-2'
      />

      <div className='flex min-h-0 flex-col gap-3 lg:col-start-1 lg:row-start-2 lg:row-span-3'>
        <div className='flex items-start justify-between gap-2'>
          <div className='space-y-1'>
            <CardTitle>{t('moex.composition.title')}</CardTitle>
            {shouldShowAsOf && compositionState.snapshotDate && (
              <div className='text-xs text-muted-foreground'>
                {t('moex.composition.asOf', {
                  date: compositionState.snapshotDate,
                })}
              </div>
            )}
          </div>
          <MoexSourceButton
            href={compositionHref}
            label={compositionSourceLabel}
            tooltip={compositionSourceLabel}
            disabledTooltip={t('moex.sources.selectIndex')}
            className='shrink-0'
          />
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto pr-2'>
          <CompositionLegend
            rows={legendRows}
            loading={trendLoading}
            hasError={trendError}
            errorMessage={t('moex.composition.error')}
            noDataMessage={t('moex.composition.noSeries')}
            translationKeyPrefix='moex.composition'
            showOther={showOtherLegend}
            otherWeight={snapshotOtherWeight}
          />
        </div>
      </div>

      <div className='flex flex-col gap-3 lg:col-start-2 lg:row-start-3'>
        <div className='flex flex-wrap items-start gap-x-4 gap-y-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-xs text-muted-foreground'>
              {t('moex.composition.tabs.label')}
            </span>
            <ButtonToggleGroup
              value={controls.composition.compositionTab}
              options={compositionTabOptions}
              onValueChange={controls.compositionActions.setCompositionTab}
            />
          </div>
          <CompositionControlsPanel
            controls={controls.composition}
            actions={controls.compositionActions}
            translationKeyPrefix='moex.composition'
            idPrefix='moex'
            selectionDateMax={latestTradeDate ?? undefined}
            hideTabs
            className='space-y-0'
          />
        </div>
      </div>

      <div className='flex min-h-[200px] flex-1 flex-col lg:col-start-2 lg:row-start-4'>
        {compositionChart}
      </div>
    </div>
  );
}
