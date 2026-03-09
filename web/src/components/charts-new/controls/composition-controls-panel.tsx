'use client';

import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CompositionDataControls } from '@/components/charts-new/types/controls';
import type { CompositionSelectionMode } from '@/lib/charting/chart-controls-url-state';
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

  return (
    <div className={cn('space-y-3', className)}>
      {!hideTabs && (
        <Tabs
          value={controls.compositionTab}
          onValueChange={next =>
            actions.setCompositionTab(next as typeof controls.compositionTab)
          }
          className='space-y-3'
        >
          <TabsList className='w-full justify-start'>
            <TabsTrigger value='snapshot'>
              {t(`${translationKeyPrefix}.tabs.snapshot`)}
            </TabsTrigger>
            <TabsTrigger value='trend'>
              {t(`${translationKeyPrefix}.tabs.trend`)}
            </TabsTrigger>
            <TabsTrigger value='stacked'>
              {t(`${translationKeyPrefix}.tabs.stacked`)}
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
      </div>

      {controls.compositionSelectionMode === 'fixed' && (
        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <Label
            htmlFor={`${idPrefix}-composition-selection-date`}
            className='text-xs text-muted-foreground'
          >
            {t(`${translationKeyPrefix}.selectionDate`)}
          </Label>
          <Input
            id={`${idPrefix}-composition-selection-date`}
            type='date'
            className='w-32'
            value={controls.compositionSelectionDate}
            max={selectionDateMax}
            onChange={event => actions.setSelectionDate(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}
