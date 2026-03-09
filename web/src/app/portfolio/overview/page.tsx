'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Pencil,
  PlayCircle,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { PortfolioAnalyticsSection } from '@/app/portfolio/portfolio-analytics-section';
import { PortfolioActionsPanel } from '@/app/portfolio/components/portfolio-actions-panel';
import { PortfolioOperationsTable } from '@/app/portfolio/components/portfolio-operations-table';
import { usePortfolio } from '@/app/portfolio/use-portfolio';
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
import { PortfolioSummaryPanel } from '@/app/portfolio/components/portfolio-summary-panel';
import { PortfolioReplicationPanel } from '@/app/portfolio/components/portfolio-replication-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import { PORTFOLIO_V2_ROUTES } from '@/lib/portfolio';

type DetailsTab = 'overview' | 'actions' | 'analytics' | 'operations' | 'replication';

function resolveDetailsTab(tab: string | null): DetailsTab {
  if (tab === 'actions' || tab === 'analytics' || tab === 'operations' || tab === 'replication') {
    return tab;
  }

  return 'overview';
}

export default function PortfolioOverviewPage() {
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
  } = usePortfolio();
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
        setError(t('portfolio.errors.profileNameRequired'));
        return;
      }

      try {
        setError('');
        await renameMutation.mutateAsync({
          id: selectedPortfolioID,
          name: trimmedName,
        });
      } catch (err) {
        setError(parseErrorMessage(err, t('portfolio.errors.updateProfile')));
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
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className='min-h-0 flex-1 gap-6'
      >
        <div className='space-y-4'>
          <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start'>
            <div className='flex items-start justify-between gap-4'>
              <div className='space-y-2'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h1 className='text-3xl font-bold'>
                    {selectedProfile?.name ||
                      t('portfolio.details.profileNameFallback')}
                  </h1>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    onClick={onEditOpen}
                    aria-label={t('portfolio.details.editNameAriaLabel')}
                    disabled={!selectedPortfolioID || renameMutation.isPending}
                  >
                    <Pencil className='size-4' />
                  </Button>
                </div>
                <p className='text-muted-foreground text-sm'>
                  {t('portfolio.details.description')}
                </p>
              </div>
              <Button asChild variant='outline' size='icon'>
                <Link
                  href={PORTFOLIO_V2_ROUTES.profiles}
                  aria-label={t('portfolio.details.backAriaLabel')}
                >
                  <ArrowLeft />
                </Link>
              </Button>
            </div>

            <TabsList className='grid h-auto w-full grid-cols-2 lg:w-auto lg:grid-cols-5'>
              <TabsTrigger value='overview'>
                <Wallet className='size-4' />
                {t('portfolio.subpages.overview')}
              </TabsTrigger>
              <TabsTrigger value='actions'>
                <PlayCircle className='size-4' />
                {t('portfolio.subpages.actions')}
              </TabsTrigger>
              <TabsTrigger value='analytics'>
                <BarChart3 className='size-4' />
                {t('portfolio.subpages.analytics')}
              </TabsTrigger>
              <TabsTrigger value='operations'>
                <ClipboardList className='size-4' />
                {t('portfolio.subpages.operations')}
              </TabsTrigger>
              <TabsTrigger value='replication'>
                <SlidersHorizontal className='size-4' />
                {t('portfolio.subpages.replication')}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {error ? (
          <Alert variant='destructive'>
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

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
            benchmarkSecid={
              selectedProfile?.replication?.is_enabled
                ? selectedProfile.replication.benchmark_secid
                : null
            }
          />
        </TabsContent>

        <TabsContent value='operations' className='min-h-0 flex-1'>
          <PortfolioOperationsTable portfolioID={selectedPortfolioID} />
        </TabsContent>

        <TabsContent value='replication' className='min-h-0 flex-1'>
          <PortfolioReplicationPanel
            portfolioID={selectedPortfolioID}
            profile={selectedProfile}
            refreshProfiles={refreshProfiles}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('portfolio.details.editNameTitle')}</DialogTitle>
            <DialogDescription>
              {t('portfolio.details.editNameDescription')}
            </DialogDescription>
          </DialogHeader>

          <form
            className='space-y-4'
            onSubmit={event => {
              void onRenameSubmit(event);
            }}
          >
            <div className='grid gap-2'>
              <Label htmlFor='portfolio-rename-profile-name'>
                {t('portfolio.details.editNameLabel')}
              </Label>
              <Input
                id='portfolio-rename-profile-name'
                value={profileNameDraft}
                onChange={event => setProfileNameDraft(event.target.value)}
                placeholder={t('portfolio.details.editNamePlaceholder')}
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
                {t('portfolio.profiles.cancelButton')}
              </Button>
              <Button type='submit' disabled={renameMutation.isPending}>
                {t('portfolio.details.editNameSave')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
