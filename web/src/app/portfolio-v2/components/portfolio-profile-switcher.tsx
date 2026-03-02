'use client';

import { useTranslation } from 'react-i18next';

import type { NormalizedPortfolioProfile } from '@/app/portfolio-v2/use-portfolio-v2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type PortfolioProfileSwitcherProps = {
  profiles: NormalizedPortfolioProfile[];
  selectedPortfolioID: number | null;
  isLoading: boolean;
  onSelectPortfolioID: (portfolioID: number | null) => void;
  onRefreshProfiles?: () => Promise<void>;
  onDeleteSelectedProfile?: () => Promise<boolean>;
  isDeleting?: boolean;
};

export function PortfolioProfileSwitcher({
  profiles,
  selectedPortfolioID,
  isLoading,
  onSelectPortfolioID,
  onRefreshProfiles,
  onDeleteSelectedProfile,
  isDeleting = false,
}: PortfolioProfileSwitcherProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle>{t('portfolioV2.selector.title')}</CardTitle>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        {isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-8 w-full' />
            <Skeleton className='h-8 w-full' />
          </div>
        ) : (
          <>
            <div className='grid gap-2'>
              <Label htmlFor='portfolio-v2-selector'>{t('portfolioV2.selector.label')}</Label>
              <select
                id='portfolio-v2-selector'
                className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                value={selectedPortfolioID ?? ''}
                onChange={event =>
                  onSelectPortfolioID(
                    event.target.value ? Number.parseInt(event.target.value, 10) : null,
                  )
                }
              >
                <option value=''>{t('portfolioV2.selector.emptyOption')}</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.provider})
                    {profile.is_default ? ` • ${t('portfolioV2.selector.defaultTag')}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {profiles.length === 0 ? (
              <p className='text-sm text-muted-foreground'>{t('portfolioV2.selector.noProfiles')}</p>
            ) : null}

            {onRefreshProfiles || onDeleteSelectedProfile ? (
              <div className='flex flex-wrap gap-2'>
                {onDeleteSelectedProfile ? (
                  <Button
                    type='button'
                    variant='destructive'
                    onClick={() => void onDeleteSelectedProfile()}
                    disabled={!selectedPortfolioID || isDeleting}
                  >
                    {t('portfolioV2.selector.deleteButton')}
                  </Button>
                ) : null}

                {onRefreshProfiles ? (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => void onRefreshProfiles()}
                  >
                    {t('portfolioV2.selector.refreshButton')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
