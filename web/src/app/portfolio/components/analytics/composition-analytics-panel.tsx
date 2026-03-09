'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CompositionControlsPanel,
  type CompositionControlActions,
} from '@/components/charts-new/controls';
import {
  CompositionLegend,
  type CompositionLegendRow,
} from '@/components/charts-new/visualization';
import type { CompositionDataControls } from '@/components/charts-new/types/controls';
import {
  ButtonToggleGroup,
  type ButtonToggleGroupOption,
} from '@/components/ui/button-toggle-group';
import { CardTitle } from '@/components/ui/card';
import type {
  CompositionDisplayTab,
  CompositionSourceMode,
} from './types';

type CompositionAnalyticsPanelProps = {
  snapshotDate: string | null;
  hasBenchmark: boolean;
  compositionDisplayTab: CompositionDisplayTab;
  compositionDisplayTabOptions: ButtonToggleGroupOption<CompositionDisplayTab>[];
  onCompositionDisplayTabChange: (next: CompositionDisplayTab) => void;
  compositionSourceMode: CompositionSourceMode;
  compositionSourceOptions: ButtonToggleGroupOption<CompositionSourceMode>[];
  onCompositionSourceChange: (next: CompositionSourceMode) => void;
  controls: CompositionDataControls;
  actions: CompositionControlActions;
  topCountOptions: number[];
  legendRows: CompositionLegendRow[];
  trendLoading: boolean;
  trendError: boolean;
  compositionNoSeriesMessage: string;
  showOtherLegend: boolean;
  snapshotOtherWeight: number;
  compositionChart: ReactNode;
};

export function CompositionAnalyticsPanel({
  snapshotDate,
  hasBenchmark,
  compositionDisplayTab,
  compositionDisplayTabOptions,
  onCompositionDisplayTabChange,
  compositionSourceMode,
  compositionSourceOptions,
  onCompositionSourceChange,
  controls,
  actions,
  topCountOptions,
  legendRows,
  trendLoading,
  trendError,
  compositionNoSeriesMessage,
  showOtherLegend,
  snapshotOtherWeight,
  compositionChart,
}: CompositionAnalyticsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row'>
      <div className='flex min-h-0 min-w-0 flex-col gap-3 lg:w-[320px]'>
        <div className='space-y-1'>
          <CardTitle>{t('portfolio.composition.title')}</CardTitle>
          {snapshotDate && (
            <div className='text-xs text-muted-foreground'>
              {t('portfolio.composition.asOf', {
                date: snapshotDate,
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
            onValueChange={onCompositionDisplayTabChange}
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
              onValueChange={onCompositionSourceChange}
            />
          </div>
        )}

        <CompositionControlsPanel
          controls={controls}
          actions={actions}
          translationKeyPrefix='portfolio.composition'
          idPrefix='portfolio'
          topCountOptions={topCountOptions}
          hideTabs
        />

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
      </div>

      {compositionChart}
    </div>
  );
}
