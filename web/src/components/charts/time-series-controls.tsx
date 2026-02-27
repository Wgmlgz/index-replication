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

type TimeSeriesControlsProps = {
  translationKeyPrefix: string;
  rangeKey: RangeKey;
  setRangeKey: (next: RangeKey) => void;
  intervalKey: IntervalKey;
  setIntervalKey: (next: IntervalKey) => void;
  customFrom: string;
  setCustomFrom: (next: string) => void;
  customTill: string;
  setCustomTill: (next: string) => void;
  viewMode: ChartViewMode;
  setViewMode: (next: ChartViewMode) => void;
  chartType: ChartType;
  setChartType?: (next: ChartType) => void;
  disableCandlestick?: boolean;
  candlestickLabelKey?: string;
  idPrefix: string;
  className?: string;
};

export function TimeSeriesControls({
  translationKeyPrefix,
  rangeKey,
  setRangeKey,
  intervalKey,
  setIntervalKey,
  customFrom,
  setCustomFrom,
  customTill,
  setCustomTill,
  viewMode,
  setViewMode,
  chartType,
  setChartType,
  disableCandlestick = false,
  candlestickLabelKey,
  idPrefix,
  className,
}: TimeSeriesControlsProps) {
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

  const isQuickRange = QUICK_RANGE_KEYS.includes(rangeKey);
  const isQuickInterval = QUICK_INTERVAL_KEYS.includes(intervalKey);

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

  const resolvedCandlestickLabelKey =
    candlestickLabelKey ?? `${translationKeyPrefix}.type.candlestick`;

  const chartTypeOptions: ButtonToggleGroupOption<ChartType>[] = [
    {
      value: 'line',
      label: t(`${translationKeyPrefix}.type.line`),
      content: <LineChart className='size-4' />,
    },
    {
      value: 'candlestick',
      label: t(resolvedCandlestickLabelKey),
      content: <CandlestickChart className='size-4' />,
      disabled: disableCandlestick,
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
            value={rangeKey}
            options={rangeToggleOptions}
            onValueChange={setRangeKey}
            select={{
              value: isQuickRange ? undefined : rangeKey,
              placeholder: t(`${translationKeyPrefix}.range.more`),
              options: rangeSelectOptions,
              onValueChange: setRangeKey,
            }}
          />
        </div>

        {rangeKey === 'custom' && (
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
                value={customFrom}
                onChange={event => setCustomFrom(event.target.value)}
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
                value={customTill}
                onChange={event => setCustomTill(event.target.value)}
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
            value={intervalKey}
            options={intervalToggleOptions}
            onValueChange={setIntervalKey}
            select={{
              value: isQuickInterval ? undefined : intervalKey,
              placeholder: t(`${translationKeyPrefix}.interval.more`),
              options: intervalSelectOptions,
              onValueChange: setIntervalKey,
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
            value={viewMode}
            options={viewModeOptions}
            onValueChange={setViewMode}
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted-foreground'>
            {t(`${translationKeyPrefix}.type.label`)}
          </span>
          <ButtonToggleGroup
            value={chartType}
            options={chartTypeOptions}
            onValueChange={next => setChartType?.(next)}
          />
        </div>
      </div>
    </div>
  );
}
