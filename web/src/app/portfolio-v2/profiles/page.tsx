'use client';

import { useTranslation } from 'react-i18next';

import { PortfolioProfileManager } from '@/app/portfolio-v2/components/portfolio-profile-manager';
import { PortfolioProfileSwitcher } from '@/app/portfolio-v2/components/portfolio-profile-switcher';
import { PortfolioSubpagesNav } from '@/app/portfolio-v2/components/portfolio-subpages-nav';
import { usePortfolioV2 } from '@/app/portfolio-v2/use-portfolio-v2';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PortfolioV2ProfilesPage() {
  const { t } = useTranslation();
  const {
    error,
    setError,
    profiles,
    profilesQuery,
    selectedPortfolioID,
    selectedProfile,
    setSelectedPortfolioID,
    refreshProfiles,
    createProfile,
    createMutation,
    deleteSelectedProfile,
    deleteMutation,
  } = usePortfolioV2();

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>{t('portfolioV2.title')}</h1>
        <p className='text-muted-foreground'>{t('portfolioV2.description')}</p>
      </div>

      <div className='space-y-1'>
        <h2 className='text-xl font-semibold'>{t('portfolioV2.profiles.title')}</h2>
        <p className='text-muted-foreground text-sm'>{t('portfolioV2.profiles.description')}</p>
      </div>

      <PortfolioSubpagesNav portfolioID={selectedPortfolioID} />

      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className='grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]'>
        <div className='min-h-0 space-y-6'>
          <PortfolioProfileSwitcher
            profiles={profiles}
            selectedPortfolioID={selectedPortfolioID}
            isLoading={profilesQuery.isLoading}
            onSelectPortfolioID={setSelectedPortfolioID}
            onRefreshProfiles={refreshProfiles}
            onDeleteSelectedProfile={deleteSelectedProfile}
            isDeleting={deleteMutation.isPending}
          />
        </div>

        <div className='min-h-0'>
          <PortfolioProfileManager
            selectedProfile={selectedProfile}
            isCreating={createMutation.isPending}
            onCreateProfile={createProfile}
            onValidationError={setError}
          />
        </div>
      </div>
    </div>
  );
}
