'use client';

import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { PortfolioAccountProvider } from '@/app/portfolio/portfolio-account-context';
import { PortfolioAnalyticsSection } from '@/app/portfolio/portfolio-analytics-section';
import { TBankPortfolioCard } from '@/app/portfolio/portfolio-card';
import { TBankConnectionProvider } from '@/components/tbank/tbank-connection-context';
import { Skeleton } from '@/components/ui/skeleton';

function PortfolioPageContent() {
  const { t } = useTranslation();

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>{t('portfolio.title')}</h1>
        <p className='text-muted-foreground'>{t('portfolio.description')}</p>
      </div>

      <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6'>
        <div className='min-h-0'>
          <PortfolioAnalyticsSection />
        </div>
        <div className='min-h-0'>
          <TBankPortfolioCard />
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <TBankConnectionProvider>
      <Suspense
        fallback={
          <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
            <div className='space-y-2'>
              <Skeleton className='h-8 w-60' />
              <Skeleton className='h-4 w-96' />
            </div>
            <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6'>
              <Skeleton className='h-full w-full' />
              <Skeleton className='h-full w-full' />
            </div>
          </div>
        }
      >
        <PortfolioAccountProvider>
          <PortfolioPageContent />
        </PortfolioAccountProvider>
      </Suspense>
    </TBankConnectionProvider>
  );
}
