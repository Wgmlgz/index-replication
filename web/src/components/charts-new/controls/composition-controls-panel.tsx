'use client';

import { useTranslation } from 'react-i18next';
import {
  ButtonToggleGroup,
  type ButtonToggleGroupOption,
} from '@/components/ui/button-toggle-group';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CompositionDataControls } from '@/components/charts-new/types/controls';
import type {
  CompositionSelectionMode,
  CompositionTab,
} from '@/lib/charting/chart-controls-url-state';
import { cn } from '@/lib/utils';
import type { CompositionControlActions } from './use-charts-new-controls';

type CompositionControlsPanelProps = {
  controls: CompositionDataControls;
  actions: CompositionControlActions;
  translationKeyPrefix: string;
  idPrefix: string;
  topCountOptions?: number[];
  selectionDateMax?: string;
  hideTabs?: boolean;
  className?: string;
};

const DEFAULT_TOP_COUNT_OPTIONS = [5, 10, 20, 50];

export function CompositionControlsPanel({
  controls,
  actions,
  translationKeyPrefix,
  idPrefix,
  topCountOptions = DEFAULT_TOP_COUNT_OPTIONS,
  selectionDateMax,
  hideTabs = false,
  className,
}: CompositionControlsPanelProps) {
  const { t } = useTranslation();
  const compositionTabOptions: ButtonToggleGroupOption<CompositionTab>[] = [
    {
      value: 'snapshot',
      label: t(`${translationKeyPrefix}.tabs.snapshot`),
      content: t(`${translationKeyPrefix}.tabs.snapshot`),
    },
    {
      value: 'trend',
      label: t(`${translationKeyPrefix}.tabs.trend`),
      content: t(`${translationKeyPrefix}.tabs.trend`),
    },
    {
      value: 'stacked',
      label: t(`${translationKeyPrefix}.tabs.stacked`),
      content: t(`${translationKeyPrefix}.tabs.stacked`),
    },
  ];
  const selectionDateControl =
    controls.compositionSelectionMode === 'fixed' ? (
      <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
        <Label
          htmlFor={`${idPrefix}-composition-selection-date`}
          className='text-xs text-muted-foreground'
        >
          {t(`${translationKeyPrefix}.selectionDate`)}
        </Label>
        <DatePicker
          id={`${idPrefix}-composition-selection-date`}
          value={controls.compositionSelectionDate}
          placeholder={t(`${translationKeyPrefix}.selectionDate`)}
          max={selectionDateMax}
          onValueChange={actions.setSelectionDate}
          size='sm'
          className='w-32'
        />
      </div>
    ) : null;

  return (
    <div className={cn('space-y-3', className)}>
      {!hideTabs && (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted-foreground'>
            {t(`${translationKeyPrefix}.tabs.label`)}
          </span>
          <ButtonToggleGroup
            value={controls.compositionTab}
            options={compositionTabOptions}
            onValueChange={actions.setCompositionTab}
          />
        </div>
      )}

      <div className='flex flex-wrap items-center gap-4'>
        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <span>{t(`${translationKeyPrefix}.topLabel`)}</span>
          <Select
            value={controls.topCount === null ? 'all' : String(controls.topCount)}
            onValueChange={value => {
              if (value === 'all') {
                actions.setTopCount(null);
                return;
              }
              const parsed = Number.parseInt(value, 10);
              if (Number.isFinite(parsed)) actions.setTopCount(parsed);
            }}
          >
            <SelectTrigger size='sm' className='h-7 text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {topCountOptions.map(value => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
              <SelectItem value='all'>{t(`${translationKeyPrefix}.all`)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <span>{t(`${translationKeyPrefix}.selectionMode.label`)}</span>
          <Select
            value={controls.compositionSelectionMode}
            onValueChange={value =>
              actions.setSelectionMode(value as CompositionSelectionMode)
            }
          >
            <SelectTrigger size='sm' className='h-7 text-xs'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='fixed'>
                {t(`${translationKeyPrefix}.selectionMode.fixed`)}
              </SelectItem>
              <SelectItem value='rolling'>
                {t(`${translationKeyPrefix}.selectionMode.rolling`)}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectionDateControl}
      </div>
    </div>
  );
}
