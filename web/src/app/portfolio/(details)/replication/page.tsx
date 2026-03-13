'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReplicationSettingsReadonly } from './components/replication-settings-readonly';

export default function PortfolioReplicationSettingsPage() {
  const { t } = useTranslation();
  const { selectedPortfolioID } = usePortfolioDetailsContext();
  const portfolioID = selectedPortfolioID;
  const [error, setError] = useState('');

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
          <CardTitle>{t('portfolio.replication.title')}</CardTitle>
          <CardDescription>{t('portfolio.replication.description')}</CardDescription>
        </CardHeader>

        <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm'>
          {error ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <ReplicationSettingsReadonly
            portfolioID={portfolioID}
            onErrorChange={setError}
          />
        </CardContent>
      </Card>
    </>
  );
}
