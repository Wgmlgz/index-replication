'use client';

import { useTranslation } from 'react-i18next';
import { Suspense } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { MoexIndexesWorkspace } from '@/components/moex-indexes/moex-indexes-workspace';
import { useMoexIndexListContext } from '@/components/moex-indexes/list/moex-indexes-list-context';
import { MoexIndexesProvider } from '@/components/moex-indexes/moex-indexes-context';

function MoexIndexesContent() {
  const { error: listError } = useMoexIndexListContext();
  const error = listError;
  const { t } = useTranslation();
  const overviewLabel = t('moex.sources.overview');

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 flex-col gap-6 overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-3xl font-bold'>{t('moex.title')}</h1>
          <p className='text-muted-foreground mt-2'>{t('moex.description')}</p>
        </div>
        <MoexSourceButton
          href={moexSourceLinks.overview}
          label={overviewLabel}
          tooltip={overviewLabel}
        />
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <MoexIndexesWorkspace />
    </div>
  );
}

export default function MoexIndexesPage() {
  return (
    <Suspense
      fallback={
        <div className='space-y-4 p-6'>
          <div className='space-y-2'>
            <Skeleton className='h-8 w-48' />
            <Skeleton className='h-4 w-64' />
          </div>
          <div className='grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)]'>
            <Skeleton className='h-[420px] w-full' />
            <div className='grid gap-6'>
              <Skeleton className='h-[240px] w-full' />
              <Skeleton className='h-[240px] w-full' />
            </div>
          </div>
        </div>
      }
    >
      <MoexIndexesProvider>
        <MoexIndexesContent />
      </MoexIndexesProvider>
    </Suspense>
  );
}
