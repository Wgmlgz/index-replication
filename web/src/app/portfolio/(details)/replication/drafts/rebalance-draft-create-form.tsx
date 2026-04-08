'use client';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RebalanceDraftCreateFormProps = {
  asOfDate: string;
  working: boolean;
  onAsOfDateChange: (value: string) => void;
  onSubmit: () => void;
};

export function RebalanceDraftCreateForm({
  asOfDate,
  working,
  onAsOfDateChange,
  onSubmit,
}: RebalanceDraftCreateFormProps) {
  const { t } = useTranslation();

  return (
    <div className='grid gap-3 md:grid-cols-[220px_auto] md:items-end'>
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
