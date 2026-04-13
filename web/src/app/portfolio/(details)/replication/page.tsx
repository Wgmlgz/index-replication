'use client';

import { useCallback, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import { RebalanceSchedulePreviewForm } from './components/rebalance-schedule-preview-form';
import { ReplicationSettingsReadonly } from './components/replication-settings-readonly';

export default function PortfolioReplicationSettingsPage() {
  const { t } = useTranslation();
  const { selectedPortfolioID, selectedProfile, refreshProfiles } = usePortfolioDetailsContext();
  const portfolioID = selectedPortfolioID;
  const isReplicationEnabled = selectedProfile?.replication?.is_enabled === true;
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const onEnableReplication = useCallback(async () => {
    if (!portfolioID) {
      return;
    }

    setWorking(true);
    setError('');
    try {
      const replication = selectedProfile?.replication;
      await portfolioApi.mePortfoliosIdReplicationPut(portfolioID, {
        is_enabled: true,
        benchmark_secid: replication?.benchmark_secid ?? undefined,
        mode_key: replication?.mode_key || 'full',
        mode_params: replication?.mode_params ?? {},
      });
      await refreshProfiles();
    } catch (err) {
      setError(parseErrorMessage(err, t('portfolio.replication.errors.save')));
    } finally {
      setWorking(false);
    }
  }, [parseErrorMessage, portfolioID, refreshProfiles, selectedProfile?.replication, t]);

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.replication.title')}</CardTitle>
          <CardDescription>{t('portfolio.replication.description')}</CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.replication.selectPrompt')}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className='h-full min-h-0 overflow-hidden'>
        <CardHeader>
          <div className='grid gap-4 lg:grid-cols-3'>
            <div className='grid gap-2'>
              <CardTitle>{t('portfolio.replication.title')}</CardTitle>
              <CardDescription>{t('portfolio.replication.description')}</CardDescription>
              {!isReplicationEnabled ? (
                <div>
                  <ConfirmActionDialog
                    trigger={(
                      <Button type='button' disabled={working}>
                        {t('portfolio.replication.isEnabledLabel')}
                      </Button>
                    )}
                    title={t('portfolio.replication.toggleConfirmTitle')}
                    description={t('portfolio.replication.toggleConfirmEnableDescription')}
                    cancelLabel={t('portfolio.replication.modeDialog.cancelButton')}
                    actionLabel={t('portfolio.replication.toggleConfirmEnableAction')}
                    disabled={working}
                    onAction={() => {
                      void onEnableReplication();
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className='col-span-2 grid content-start gap-2'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='grid gap-2'>
                  <CardTitle>{t('portfolio.replication.schedule.title')}</CardTitle>
                  <CardDescription>{t('portfolio.replication.schedule.description')}</CardDescription>
                </div>
                <div className='flex items-center gap-2'>
                  <Label htmlFor='schedule-header-enabled' className='text-xs text-muted-foreground'>
                    {t('portfolio.replication.schedule.enableLabel')}
                  </Label>
                  <Switch
                    id='schedule-header-enabled'
                    checked={scheduleEnabled}
                    onCheckedChange={setScheduleEnabled}
                    aria-label={t('portfolio.replication.schedule.enableLabel')}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden text-sm'>
          {error ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-3'>
            <div className='min-h-0 overflow-y-auto'>
              <ReplicationSettingsReadonly
                portfolioID={portfolioID}
                onErrorChange={setError}
                showEnableAction={false}
              />
            </div>
            <div className='min-h-0 overflow-y-auto col-span-2'>
              <RebalanceSchedulePreviewForm
                portfolioID={portfolioID}
                scheduleEnabled={scheduleEnabled}
                onScheduleEnabledChange={setScheduleEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
