'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { PortfolioAnalyticsSection } from '@/app/portfolio-v2/portfolio-analytics-section';
import { PortfolioActionsPanel } from '@/app/portfolio-v2/components/portfolio-actions-panel';
import { PortfolioOperationsTable } from '@/app/portfolio-v2/components/portfolio-operations-table';
import { usePortfolioV2 } from '@/app/portfolio-v2/use-portfolio-v2';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PortfolioSummaryPanel } from '@/app/portfolio-v2/components/portfolio-summary-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import { PORTFOLIO_V2_ROUTES } from '@/lib/portfolio-v2';

type DetailsTab = 'overview' | 'actions' | 'analytics' | 'operations';

function resolveDetailsTab(tab: string | null): DetailsTab {
  if (tab === 'actions' || tab === 'analytics' || tab === 'operations') {
    return tab;
  }

  return 'overview';
}

export default function PortfolioV2OverviewPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    error,
    setError,
    selectedPortfolioID,
    selectedProfile,
    refreshProfiles,
  } = usePortfolioV2();
  const [editOpen, setEditOpen] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState('');

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }

    return fallback;
  }, []);

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      await portfolioApi.mePortfoliosIdPatch(id, { name });
    },
    onSuccess: async () => {
      await refreshProfiles();
      setEditOpen(false);
      setError('');
    },
  });

  const onEditOpen = useCallback(() => {
    setProfileNameDraft(selectedProfile?.name || '');
    setEditOpen(true);
  }, [selectedProfile?.name]);

  const onRenameSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedPortfolioID) {
        return;
      }

      const trimmedName = profileNameDraft.trim();
      if (!trimmedName) {
        setError(t('portfolioV2.errors.profileNameRequired'));
        return;
      }

      try {
        setError('');
        await renameMutation.mutateAsync({
          id: selectedPortfolioID,
          name: trimmedName,
        });
      } catch (err) {
        setError(parseErrorMessage(err, t('portfolioV2.errors.updateProfile')));
      }
    },
    [
      parseErrorMessage,
      profileNameDraft,
      renameMutation,
      selectedPortfolioID,
      setError,
      t,
    ],
  );

  const activeTab = useMemo(
    () => resolveDetailsTab(searchParams.get('tab')),
    [searchParams],
  );
  const handleTabChange = useCallback(
    (nextTab: string) => {
      const resolvedTab = resolveDetailsTab(nextTab);
      const nextParams = new URLSearchParams(searchParams.toString());

      if (resolvedTab === 'overview') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', resolvedTab);
      }

      const query = nextParams.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
      <div className='flex items-start justify-between gap-3'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold'>{t('portfolioV2.details.title')}</h1>
          <p className='text-muted-foreground text-sm'>{t('portfolioV2.details.description')}</p>
          <div className='flex items-center gap-2'>
            <p className='text-sm text-muted-foreground'>
              {t('portfolioV2.details.profileName', {
                name: selectedProfile?.name || t('portfolioV2.details.profileNameFallback'),
              })}
            </p>
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={onEditOpen}
              aria-label={t('portfolioV2.details.editNameAriaLabel')}
              disabled={!selectedPortfolioID || renameMutation.isPending}
            >
              <Pencil className='size-4' />
            </Button>
          </div>
        </div>
        <Button asChild variant='outline' size='icon'>
          <Link
            href={PORTFOLIO_V2_ROUTES.profiles}
            aria-label={t('portfolioV2.details.backAriaLabel')}
          >
            <ArrowLeft />
          </Link>
        </Button>
      </div>

      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className='min-h-0 flex-1'
      >
        <TabsList className='grid h-auto w-full grid-cols-4'>
          <TabsTrigger value='overview'>{t('portfolioV2.subpages.overview')}</TabsTrigger>
          <TabsTrigger value='actions'>{t('portfolioV2.subpages.actions')}</TabsTrigger>
          <TabsTrigger value='analytics'>{t('portfolioV2.subpages.analytics')}</TabsTrigger>
          <TabsTrigger value='operations'>{t('portfolioV2.subpages.operations')}</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='min-h-0 flex-1'>
          <PortfolioSummaryPanel portfolioID={selectedPortfolioID} />
        </TabsContent>

        <TabsContent value='actions' className='min-h-0 flex-1'>
          <PortfolioActionsPanel
            portfolioID={selectedPortfolioID}
            profile={selectedProfile}
          />
        </TabsContent>

        <TabsContent value='analytics' className='min-h-0 flex-1'>
          <PortfolioAnalyticsSection
            portfolioID={selectedPortfolioID}
            portfolioName={selectedProfile?.name || ''}
          />
        </TabsContent>

        <TabsContent value='operations' className='min-h-0 flex-1'>
          <PortfolioOperationsTable portfolioID={selectedPortfolioID} />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('portfolioV2.details.editNameTitle')}</DialogTitle>
            <DialogDescription>{t('portfolioV2.details.editNameDescription')}</DialogDescription>
          </DialogHeader>

          <form
            className='space-y-4'
            onSubmit={event => {
              void onRenameSubmit(event);
            }}
          >
            <div className='grid gap-2'>
              <Label htmlFor='portfolio-v2-rename-profile-name'>
                {t('portfolioV2.details.editNameLabel')}
              </Label>
              <Input
                id='portfolio-v2-rename-profile-name'
                value={profileNameDraft}
                onChange={event => setProfileNameDraft(event.target.value)}
                placeholder={t('portfolioV2.details.editNamePlaceholder')}
                disabled={renameMutation.isPending}
              />
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setEditOpen(false)}
                disabled={renameMutation.isPending}
              >
                {t('portfolioV2.profiles.cancelButton')}
              </Button>
              <Button type='submit' disabled={renameMutation.isPending}>
                {t('portfolioV2.details.editNameSave')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
