'use client';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type RebalanceDraftExecutionMode = 'manual' | 'automatic';

type RebalanceDraftCreateFormProps = {
  executionMode: RebalanceDraftExecutionMode;
  asOfDate: string;
  working: boolean;
  onExecutionModeChange: (mode: RebalanceDraftExecutionMode) => void;
  onAsOfDateChange: (value: string) => void;
  onSubmit: () => void;
};

export function RebalanceDraftCreateForm({
  executionMode,
  asOfDate,
  working,
  onExecutionModeChange,
  onAsOfDateChange,
  onSubmit,
}: RebalanceDraftCreateFormProps) {
  const { t } = useTranslation();

  return (
    <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end'>
      <div className='grid gap-2'>
        <Label htmlFor='rebalance-execution-mode'>
          {t('portfolio.replication.rebalances.executionModeLabel')}
        </Label>
        <Select
          value={executionMode}
          onValueChange={value => onExecutionModeChange(value === 'automatic' ? 'automatic' : 'manual')}
          disabled={working}
        >
          <SelectTrigger id='rebalance-execution-mode'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='manual'>
              {t('portfolio.replication.rebalances.executionModeOptions.manual')}
            </SelectItem>
            <SelectItem value='automatic'>
              {t('portfolio.replication.rebalances.executionModeOptions.automatic')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='rebalance-as-of-date'>
          {t('portfolio.replication.rebalances.asOfDateLabel')}
        </Label>
        <Input
          id='rebalance-as-of-date'
          type='date'
          value={asOfDate}
          onChange={event => onAsOfDateChange(event.target.value)}
          disabled={working}
        />
      </div>

      <Button type='button' onClick={() => onSubmit()} disabled={working}>
        {working
          ? t('portfolio.replication.rebalances.createDraftWorking')
          : t('portfolio.replication.rebalances.createDraftButton')}
      </Button>
    </div>
  );
}
