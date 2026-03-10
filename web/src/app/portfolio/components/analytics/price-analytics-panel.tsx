'use client';

import { useTranslation } from 'react-i18next';
import { PriceControlsPanel, type PriceControlActions } from '@/components/charts-new/controls';
import { PriceVisualization, type PriceVisualizationSeries } from '@/components/charts-new/visualization';
import type { PriceDataControls } from '@/components/charts-new/types/controls';
import type { PriceVisualizationDataState } from '@/components/charts-new/data';
import {
  ButtonToggleGroup,
  type ButtonToggleGroupOption,
} from '@/components/ui/button-toggle-group';
import type { PortfolioPriceMode } from './types';

type PriceAnalyticsPanelProps = {
  priceState: PriceVisualizationDataState;
  controls: PriceDataControls;
  actions: PriceControlActions;
  priceMode: PortfolioPriceMode;
  priceModeOptions: ButtonToggleGroupOption<PortfolioPriceMode>[];
  onPriceModeChange: (next: PortfolioPriceMode) => void;
  chartLoading: boolean;
  chartHasError: boolean;
  chartNoDataMessage: string;
  priceSeries: PriceVisualizationSeries[];
};

const formatSignedNumber = (
  formatter: Intl.NumberFormat,
  value: number,
): string => {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatter.format(value)}`;
};

export function PriceAnalyticsPanel({
  priceState,
  controls,
  actions,
  priceMode,
  priceModeOptions,
  onPriceModeChange,
  chartLoading,
  chartHasError,
  chartNoDataMessage,
  priceSeries,
}: PriceAnalyticsPanelProps) {
  const { t } = useTranslation();

  return (
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
          controls={controls}
          actions={actions}
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
            onValueChange={onPriceModeChange}
          />
        </div>
      </div>

      <PriceVisualization
        loading={chartLoading}
        hasError={chartHasError && priceSeries[0]?.data.length === 0}
        errorMessage={t('portfolio.chart.error')}
        noDataMessage={chartNoDataMessage}
        series={priceSeries}
        visibleRange={priceState.dateRange}
        className='flex min-h-[200px] min-w-0 flex-1 items-stretch overflow-hidden'
      />
    </div>
  );
}
