'use client';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

type RebalanceDraftCreateFormProps = {
  working: boolean;
  canCreateDraft: boolean;
  disabledReasonText?: string;
  onSubmit: () => void;
};

export function RebalanceDraftCreateForm({
  working,
  canCreateDraft,
  disabledReasonText,
  onSubmit,
}: RebalanceDraftCreateFormProps) {
  const { t } = useTranslation();
  const createDisabled = working || !canCreateDraft;

  return (
    <div className='grid gap-1'>
      <Button type='button' onClick={() => onSubmit()} disabled={createDisabled}>
        {working
          ? t('portfolio.replication.rebalances.createDraftWorking')
          : t('portfolio.replication.rebalances.createDraftButton')}
      </Button>
      {!canCreateDraft && disabledReasonText ? (
        <p className='text-xs text-muted-foreground'>{disabledReasonText}</p>
      ) : null}
    </div>
  );
}
