'use client';

import { useMemo } from 'react';
import type { MoexIndex } from '@/api-client';
import {
  buildCompositionLegendRows,
  calculateSnapshotOtherWeight,
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
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import type {
  CompositionDataControls,
  PriceDataControls,
} from '@/components/charts-new/types/controls';

const TEST_INDEX: MoexIndex = {
  secid: 'IMOEX',
  name: 'MOEX Russia Index',
  shortName: 'IMOEX',
  currency: 'RUB',
  decimals: 2,
  hasComposition: true,
};

const TEST_DEFAULT_PRICE_CONTROLS: Partial<PriceDataControls> = {
  rangeKey: '1y',
  intervalKey: '1d',
  viewMode: 'price',
  chartType: 'line',
};

const TEST_DEFAULT_COMPOSITION_CONTROLS: Partial<CompositionDataControls> = {
  rangeKey: '1y',
  intervalKey: '1w',
  compositionSelectionMode: 'fixed',
  compositionSelectionDate: '',
  compositionTab: 'trend',
  topCount: 10,
};

const resolveLatestTradeDate = (data: PriceChartData): string | null => {
  if (data.length === 0) return null;
  const lastPoint = data[data.length - 1];
  if (!lastPoint || typeof lastPoint.time !== 'string') return null;
  return lastPoint.time.length > 0 ? lastPoint.time : null;
};

export default function ChartsNewTestPage() {
  const { t } = useTranslation();
  const controls = useChartsNewControls({
    defaults: {
      price: TEST_DEFAULT_PRICE_CONTROLS,
      composition: TEST_DEFAULT_COMPOSITION_CONTROLS,
    },
  });

  const priceState = usePriceVisualizationData(TEST_INDEX, controls.price);
  const latestTradeDate = useMemo(
    () => resolveLatestTradeDate(priceState.data),
    [priceState.data]
  );

  const compositionState = useCompositionVisualizationData({
    selectedIndex: TEST_INDEX,
    latestTradeDate,
    controls: controls.composition,
  });

  const snapshotItems = useMemo(() => {
    if (controls.composition.topCount === null) {
      return compositionState.snapshotItems;
    }
    return compositionState.snapshotItems.slice(0, controls.composition.topCount);
  }, [compositionState.snapshotItems, controls.composition.topCount]);
  const legendRows = useMemo(
    () => buildCompositionLegendRows(compositionState.series, compositionState.snapshotItems),
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
  const compositionTab = controls.composition.compositionTab;

  const compositionChart =
    compositionTab === 'snapshot' ? (
      <CompositionSnapshotVisualization
        loading={compositionState.snapshotLoading}
        hasError={compositionState.snapshotError}
        errorMessage={t('chartsNewTest.composition.error')}
        noDataMessage={t('chartsNewTest.composition.noData')}
        items={snapshotItems}
        className='min-h-[200px] h-full'
      />
    ) : compositionTab === 'stacked' ? (
      <CompositionStackedVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('chartsNewTest.composition.error')}
        noDataMessage={t('chartsNewTest.composition.noSeries')}
        series={compositionState.series}
        className='min-h-[200px] h-full'
      />
    ) : (
      <CompositionTrendVisualization
        loading={trendLoading}
        hasError={trendError}
        errorMessage={t('chartsNewTest.composition.error')}
        noDataMessage={t('chartsNewTest.composition.noSeries')}
        series={compositionState.series}
        className='min-h-[200px] h-full'
      />
    );

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 flex-col gap-6 overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-3xl font-bold'>{t('chartsNewTest.title')}</h1>
          <p className='text-muted-foreground mt-2'>
            {t('chartsNewTest.description')}
          </p>
        </div>
      </div>

      <div className='grid flex-1 min-h-0 grid-cols-1 gap-6 grid-rows-[minmax(0,1fr)] lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)]'>
        <Card className='h-full min-h-0'>
          <CardHeader>
            <CardTitle>{t('chartsNewTest.settings.title')}</CardTitle>
            <CardDescription>
              {t('chartsNewTest.settings.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className='flex min-h-0 flex-col gap-3 overflow-y-auto'>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.secid')}: ${TEST_INDEX.secid}`}
            </Badge>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.priceRange')}: ${controls.price.rangeKey}`}
            </Badge>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.priceInterval')}: ${controls.price.intervalKey}`}
            </Badge>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.priceType')}: ${controls.price.chartType}`}
            </Badge>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.compositionRange')}: ${controls.composition.rangeKey}`}
            </Badge>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.compositionInterval')}: ${controls.composition.intervalKey}`}
            </Badge>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.compositionMode')}: ${controls.composition.compositionSelectionMode}`}
            </Badge>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.compositionTab')}: ${controls.composition.compositionTab}`}
            </Badge>
            <Badge variant='secondary'>
              {`${t('chartsNewTest.labels.compositionTop')}: ${String(controls.composition.topCount)}`}
            </Badge>
          </CardContent>
        </Card>

        <div className='min-h-0'>
          <Card className='h-full min-h-0'>
            <CardHeader>
              <CardTitle>
                {TEST_INDEX.secid} - {TEST_INDEX.name}
              </CardTitle>
            </CardHeader>
            <CardContent className='grid h-full min-h-0 gap-4 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]'>
              <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
                <div className='flex flex-col gap-3 lg:w-[320px]'>
                  <CardTitle className='text-base'>
                    {t('chartsNewTest.price.title')}
                  </CardTitle>
                  <PriceControlsPanel
                    controls={controls.price}
                    actions={controls.priceActions}
                    translationKeyPrefix='moex.chart'
                    idPrefix='charts-new-price'
                  />
                </div>
                <PriceVisualization
                  loading={priceState.loading}
                  hasError={priceState.error}
                  errorMessage={t('chartsNewTest.price.error')}
                  noDataMessage={t('chartsNewTest.price.noData')}
                  data={priceState.data}
                  seriesType={controls.price.chartType}
                  className='flex min-h-[200px] flex-1 items-stretch'
                />
              </div>

              <div className='flex min-h-0 flex-1 flex-col gap-4 lg:flex-row'>
                <div className='flex min-h-0 flex-col gap-3 lg:w-[320px]'>
                  <CardTitle className='text-base'>
                    {t('chartsNewTest.composition.legendTitle')}
                  </CardTitle>
                  <CompositionControlsPanel
                    controls={controls.composition}
                    actions={controls.compositionActions}
                    translationKeyPrefix='moex.composition'
                    idPrefix='charts-new-composition'
                    selectionDateMax={latestTradeDate ?? undefined}
                  />
                  <div className='min-h-0 flex-1 overflow-y-auto pr-2'>
                    <CompositionLegend
                      rows={legendRows}
                      loading={trendLoading}
                      hasError={trendError}
                      errorMessage={t('chartsNewTest.composition.error')}
                      noDataMessage={t('chartsNewTest.composition.noSeries')}
                      translationKeyPrefix='moex.composition'
                      showOther={showOtherLegend}
                      otherWeight={snapshotOtherWeight}
                    />
                  </div>
                </div>
                <div className='flex min-h-[200px] flex-1 flex-col'>
                  {compositionChart}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
