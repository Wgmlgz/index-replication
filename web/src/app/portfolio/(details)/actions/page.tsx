'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import type { PortfolioActionResponse } from '@/api-client';
import {
  buildPortfolioActionTabs,
  resolvePortfolioActionTabValue,
} from '@/app/portfolio/components/actions-tabs';
import { PortfolioActionControl } from '@/app/portfolio/components/portfolio-summary-actions/portfolio-action-control';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

export default function PortfolioActionsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [actionResult, setActionResult] = useState<PortfolioActionResponse | null>(null);

  const actions = useMemo(
    () => selectedProfile?.capabilities?.actions ?? [],
    [selectedProfile?.capabilities?.actions],
  );
  const actionTabs = useMemo(
    () =>
      buildPortfolioActionTabs(actions, t('portfolio.card.runAction')),
    [actions, t],
  );
  const requestedActionTab = searchParams.get('action_tab')?.trim() ?? '';
  const activeActionTab = useMemo(() => {
    return resolvePortfolioActionTabValue(actionTabs, requestedActionTab);
  }, [actionTabs, requestedActionTab]);
  const selectedAction = useMemo(
    () => actionTabs.find(tab => tab.value === activeActionTab)?.action ?? null,
    [actionTabs, activeActionTab],
  );

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const refreshData = useCallback(
    async (targetPortfolioID: number) => {
      setError('');
      try {
        await portfolioApi.mePortfoliosIdSummaryGet(targetPortfolioID);
      } catch (err) {
        setError(parseErrorMessage(err, t('portfolio.errors.summary')));
      }
    },
    [parseErrorMessage, t],
  );

  const runAction = useCallback(
    async (actionID: string, payload?: Record<string, unknown>) => {
      if (!selectedPortfolioID) {
        return;
      }

      setError('');
      setWorking(true);
      try {
        const actionIDValue = crypto.randomUUID();
        const response = (
          await portfolioApi.mePortfoliosIdActionsActionPost(selectedPortfolioID, actionID, {
            payload: {
              ...(payload ?? {}),
              action_id: actionIDValue,
            },
          })
        ).data;
        setActionResult(response);
        await refreshData(selectedPortfolioID);
      } catch (err) {
        setError(parseErrorMessage(err, t('portfolio.errors.action')));
      } finally {
        setWorking(false);
      }
    },
    [parseErrorMessage, selectedPortfolioID, refreshData, t],
  );

  if (!selectedPortfolioID) {
    return (
      <Card>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.actions.selectPrompt')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='h-full min-h-0 overflow-hidden'>
      <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm'>
        {error ? (
          <Alert variant='destructive'>
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {actionResult ? (
          <div className='rounded-md border bg-muted/40 p-3'>
            {t('portfolio.card.actionResult', { action: actionResult.action || '-' })}
          </div>
        ) : null}

        {!selectedAction ? (
          <span className='text-muted-foreground'>{t('portfolio.overview.noQuickActions')}</span>
        ) : (
          <PortfolioActionControl
            action={selectedAction}
            working={working}
            onRunAction={runAction}
          />
        )}
      </CardContent>
    </Card>
  );
}
