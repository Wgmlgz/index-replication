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
import type { CompositionSelectionMode } from '@/lib/charting/chart-controls-url-state';
import { cn } from '@/lib/utils';

type CompositionControlsProps = {
  translationKeyPrefix: string;
  topCount: number | null;
  setTopCount: (next: number | null) => void;
  topCountOptions: number[];
  selectionMode: CompositionSelectionMode;
  setSelectionMode: (next: CompositionSelectionMode) => void;
  selectionDate: string;
  setSelectionDate: (next: string) => void;
  selectionDateMax?: string;
  dateInputWidthClassName?: string;
  idPrefix: string;
  className?: string;
};

export function CompositionControls({
  translationKeyPrefix,
  topCount,
  setTopCount,
  topCountOptions,
  selectionMode,
  setSelectionMode,
  selectionDate,
  setSelectionDate,
  selectionDateMax,
  dateInputWidthClassName = 'w-32',
  idPrefix,
  className,
}: CompositionControlsProps) {
  const { t } = useTranslation();

  return (
    <div className={cn('space-y-3', className)}>
      <div className='flex flex-wrap items-center gap-4'>
        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
          <span>{t(`${translationKeyPrefix}.topLabel`)}</span>
          <Select
            value={topCount === null ? 'all' : String(topCount)}
            onValueChange={value => {
              if (value === 'all') {
                setTopCount(null);
                return;
              }
              const parsed = Number.parseInt(value, 10);
              if (Number.isFinite(parsed)) setTopCount(parsed);
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
            value={selectionMode}
            onValueChange={value =>
              setSelectionMode(value as CompositionSelectionMode)
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

      {selectionMode === 'fixed' && (
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
            className={dateInputWidthClassName}
            value={selectionDate}
            max={selectionDateMax}
            onChange={event => setSelectionDate(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}
