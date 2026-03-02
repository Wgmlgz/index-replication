'use client';

import { useTranslation } from 'react-i18next';

import { PortfolioAnalyticsSection } from '@/app/portfolio-v2/portfolio-analytics-section';
import { PortfolioProfileSwitcher } from '@/app/portfolio-v2/components/portfolio-profile-switcher';
import { PortfolioSubpagesNav } from '@/app/portfolio-v2/components/portfolio-subpages-nav';
import { usePortfolioV2 } from '@/app/portfolio-v2/use-portfolio-v2';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PortfolioV2AnalyticsPage() {
  const { t } = useTranslation();
  const {
    error,
    profiles,
    profilesQuery,
    selectedPortfolioID,
    selectedProfile,
    setSelectedPortfolioID,
    refreshProfiles,
  } = usePortfolioV2();

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>{t('portfolioV2.title')}</h1>
        <p className='text-muted-foreground'>{t('portfolioV2.description')}</p>
      </div>

      <div className='space-y-1'>
        <h2 className='text-xl font-semibold'>{t('portfolioV2.analyticsPage.title')}</h2>
        <p className='text-muted-foreground text-sm'>
          {t('portfolioV2.analyticsPage.description')}
        </p>
      </div>

      <PortfolioSubpagesNav portfolioID={selectedPortfolioID} />

      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <PortfolioProfileSwitcher
        profiles={profiles}
        selectedPortfolioID={selectedPortfolioID}
        isLoading={profilesQuery.isLoading}
        onSelectPortfolioID={setSelectedPortfolioID}
        onRefreshProfiles={refreshProfiles}
      />

      <div className='min-h-0 flex-1'>
        <PortfolioAnalyticsSection
          portfolioID={selectedPortfolioID}
          portfolioName={selectedProfile?.name || ''}
        />
      </div>
    </div>
  );
}
