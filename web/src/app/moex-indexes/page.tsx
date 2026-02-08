'use client';

import { useTranslation } from 'react-i18next';
import { Suspense } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { IndexCompositionCard } from '@/components/moex-indexes/composition/index-composition-card';
import { IndexChartCard } from '@/components/moex-indexes/detail/index-chart-card';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { useMoexIndexDetailContext } from '@/components/moex-indexes/detail/moex-indexes-detail-context';
import { IndexListCard } from '@/components/moex-indexes/list/index-list-card';
import { useMoexIndexListContext } from '@/components/moex-indexes/list/moex-indexes-list-context';
import { MoexIndexesProvider } from '@/components/moex-indexes/moex-indexes-context';

function MoexIndexesContent() {
  const { error: listError } = useMoexIndexListContext();
  const { error: detailError } = useMoexIndexDetailContext();
  const error = listError ?? detailError;
  const { t } = useTranslation();
  const overviewLabel = t('moex.sources.overview');

  return (
    <div className='flex h-[calc(100svh-65px-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 flex-col gap-6 overflow-hidden'>
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

      <div className='grid flex-1 min-h-0 grid-cols-1 gap-6 grid-rows-[minmax(0,1fr)] lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)]'>
        <IndexListCard />
        <div className='grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-6'>
          <IndexChartCard />
          <IndexCompositionCard />
        </div>
      </div>
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
