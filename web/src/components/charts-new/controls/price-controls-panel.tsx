'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CandlestickChart, DollarSign, LineChart, Percent } from 'lucide-react';
import {
  ButtonToggleGroup,
  type ButtonToggleGroupOption,
  type ButtonToggleGroupSelectOption,
} from '@/components/ui/button-toggle-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PriceDataControls } from '@/components/charts-new/types/controls';
import {
  QUICK_INTERVAL_KEYS,
  QUICK_RANGE_KEYS,
  buildExtraIntervalOptions,
  buildExtraRangeOptions,
  buildIntervalOptions,
  buildRangeOptions,
  type ChartType,
  type ChartViewMode,
  type IntervalKey,
  type RangeKey,
} from '@/lib/charting/time-series-controls';
import { cn } from '@/lib/utils';
import type { PriceControlActions } from './use-charts-new-controls';

type PriceControlsPanelProps = {
  controls: PriceDataControls;
  actions: PriceControlActions;
  translationKeyPrefix: string;
  idPrefix: string;
  hideChartType?: boolean;
  className?: string;
};

export function PriceControlsPanel({
  controls,
  actions,
  translationKeyPrefix,
  idPrefix,
  hideChartType = false,
  className,
}: PriceControlsPanelProps) {
  const { t } = useTranslation();

  const rangeOptions = useMemo(
    () => buildRangeOptions(translationKeyPrefix),
    [translationKeyPrefix]
  );
  const intervalOptions = useMemo(
    () => buildIntervalOptions(translationKeyPrefix),
    [translationKeyPrefix]
  );
  const extraRangeOptions = useMemo(
    () => buildExtraRangeOptions(translationKeyPrefix),
    [translationKeyPrefix]
  );
  const extraIntervalOptions = useMemo(
    () => buildExtraIntervalOptions(translationKeyPrefix),
    [translationKeyPrefix]
  );

  const isQuickRange = QUICK_RANGE_KEYS.includes(controls.rangeKey);
  const isQuickInterval = QUICK_INTERVAL_KEYS.includes(controls.intervalKey);

  const rangeToggleOptions: ButtonToggleGroupOption<RangeKey>[] =
    QUICK_RANGE_KEYS.map(key => {
      const option = rangeOptions.find(item => item.value === key);
      if (!option) return null;
      return {
        value: key,
        label: t(option.labelKey),
        content: t(option.labelKey),
      };
    }).filter(option => option !== null);

  const rangeSelectOptions: ButtonToggleGroupSelectOption<RangeKey>[] =
    extraRangeOptions.map(option => ({
      value: option.value,
      label: t(option.labelKey),
    }));

  const intervalToggleOptions: ButtonToggleGroupOption<IntervalKey>[] =
    QUICK_INTERVAL_KEYS.map(key => {
      const option = intervalOptions.find(item => item.value === key);
      if (!option) return null;
      return {
        value: key,
        label: t(option.labelKey),
        content: t(option.labelKey),
      };
    }).filter(option => option !== null);

  const intervalSelectOptions: ButtonToggleGroupSelectOption<IntervalKey>[] =
    extraIntervalOptions.map(option => ({
      value: option.value,
      label: t(option.labelKey),
    }));

  const viewModeOptions: ButtonToggleGroupOption<ChartViewMode>[] = [
    {
      value: 'price',
      label: t(`${translationKeyPrefix}.view.price`),
      content: <DollarSign className='size-4' />,
    },
    {
      value: 'percent',
      label: t(`${translationKeyPrefix}.view.percent`),
      content: <Percent className='size-4' />,
    },
  ];

  const chartTypeOptions: ButtonToggleGroupOption<ChartType>[] = [
    {
      value: 'line',
      label: t(`${translationKeyPrefix}.type.line`),
      content: <LineChart className='size-4' />,
    },
    {
      value: 'candlestick',
      label: t(`${translationKeyPrefix}.type.candlestick`),
      content: <CandlestickChart className='size-4' />,
    },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      <div className='space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted-foreground'>
            {t(`${translationKeyPrefix}.range.label`)}
          </span>
          <ButtonToggleGroup
            value={controls.rangeKey}
            options={rangeToggleOptions}
            onValueChange={actions.setRangeKey}
            select={{
              value: isQuickRange ? undefined : controls.rangeKey,
              placeholder: t(`${translationKeyPrefix}.range.more`),
              options: rangeSelectOptions,
              onValueChange: actions.setRangeKey,
            }}
          />
        </div>

        {controls.rangeKey === 'custom' && (
          <div className='flex flex-wrap items-end gap-3'>
            <div className='space-y-1'>
              <Label
                htmlFor={`${idPrefix}-chart-from`}
                className='text-xs text-muted-foreground'
              >
                {t(`${translationKeyPrefix}.range.from`)}
              </Label>
              <Input
                id={`${idPrefix}-chart-from`}
                type='date'
                value={controls.customFrom}
                onChange={event => actions.setCustomFrom(event.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label
                htmlFor={`${idPrefix}-chart-to`}
                className='text-xs text-muted-foreground'
              >
                {t(`${translationKeyPrefix}.range.to`)}
              </Label>
              <Input
                id={`${idPrefix}-chart-to`}
                type='date'
                value={controls.customTill}
                onChange={event => actions.setCustomTill(event.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className='space-y-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted-foreground'>
            {t(`${translationKeyPrefix}.interval.label`)}
          </span>
          <ButtonToggleGroup
            value={controls.intervalKey}
            options={intervalToggleOptions}
            onValueChange={actions.setIntervalKey}
            select={{
              value: isQuickInterval ? undefined : controls.intervalKey,
              placeholder: t(`${translationKeyPrefix}.interval.more`),
              options: intervalSelectOptions,
              onValueChange: actions.setIntervalKey,
            }}
          />
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted-foreground'>
            {t(`${translationKeyPrefix}.view.label`)}
          </span>
          <ButtonToggleGroup
            value={controls.viewMode}
            options={viewModeOptions}
            onValueChange={actions.setViewMode}
          />
        </div>

        {!hideChartType && (
          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-xs text-muted-foreground'>
              {t(`${translationKeyPrefix}.type.label`)}
            </span>
            <ButtonToggleGroup
              value={controls.chartType}
              options={chartTypeOptions}
              onValueChange={actions.setChartType}
            />
          </div>
        )}
      </div>
    </div>
  );
}
