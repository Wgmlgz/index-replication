'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { isIndexInactive } from '@/components/moex-indexes/moex-indexes-activity';
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
  const { selectedIndex, selectedIndexCollections } = useMoexIndexDetailContext();
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

  const collectionPreview = selectedIndexCollections.slice(0, 3);
  const remainingCollections =
    selectedIndexCollections.length > 3 ? selectedIndexCollections.length - 3 : 0;
  const groupsLabel = selectedIndex
    ? selectedIndexCollections.length > 0
      ? remainingCollections > 0
        ? t('moex.groups.more', {
            groups: collectionPreview.join(', '),
            count: remainingCollections,
          })
        : t('moex.groups.list', { groups: collectionPreview.join(', ') })
      : t('moex.groups.none')
    : '';

  const isInactive =
    selectedIndex && selectedIndex.lastActiveDate
      ? isIndexInactive(selectedIndex.lastActiveDate)
      : false;

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

  return (
    <div
      className={`grid h-full min-h-0 gap-4 ${
        showComposition ? 'grid-rows-2' : 'grid-rows-1'
      }`}
    >
      <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
        <div className='flex flex-col gap-3 lg:w-[320px]'>
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
          {selectedIndex && (
            <>
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
                      value: priceState.numberFormatter.format(selectedIndex.annualHigh),
                    })}
                  </Badge>
                )}
                {selectedIndex.annualLow != null && (
                  <Badge variant='outline'>
                    {t('moex.chart.min', {
                      value: priceState.numberFormatter.format(selectedIndex.annualLow),
                    })}
                  </Badge>
                )}
              </div>
              {groupsLabel && (
                <div className='text-xs text-muted-foreground'>{groupsLabel}</div>
              )}
            </>
          )}
        </div>
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

      {showComposition && (
        <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
          <div className='flex min-h-0 flex-col gap-3 lg:w-[320px]'>
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

            <CompositionControlsPanel
              controls={controls.composition}
              actions={controls.compositionActions}
              translationKeyPrefix='moex.composition'
              idPrefix='moex'
              selectionDateMax={latestTradeDate ?? undefined}
            />

            <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
              {selectedIndex && <Badge variant='outline'>{selectedIndex.secid}</Badge>}
              <Badge variant='outline'>
                {t('moex.composition.topCount', { count: snapshotItems.length })}
              </Badge>
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
          <div className='flex min-h-[200px] flex-1 flex-col'>{compositionChart}</div>
        </div>
      )}
    </div>
  );
}
