'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CircleHelp,
  FlaskConical,
  Monitor,
  Pencil,
  PlayCircle,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import { usePortfolio } from '@/app/portfolio/use-portfolio';
import { PortfolioDetailsProvider } from '@/app/portfolio/components/portfolio-details-context';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import {
  parsePortfolioID,
  PORTFOLIO_ID_QUERY_KEY,
  PORTFOLIO_V2_ROUTES,
} from '@/lib/portfolio';

type PortfolioDetailsSection = 'overview' | 'actions' | 'replication';

type PortfolioDetailsLayoutProps = {
  children: ReactNode;
};

const SECTION_ROUTES: Record<PortfolioDetailsSection, string> = {
  overview: PORTFOLIO_V2_ROUTES.overview,
  actions: PORTFOLIO_V2_ROUTES.actions,
  replication: PORTFOLIO_V2_ROUTES.replicationDrafts,
};

function resolveLegacyRoute(
  tab: string | null,
  overviewTab: string | null,
): string | null {
  if (tab === 'actions') {
    return PORTFOLIO_V2_ROUTES.actions;
  }
  if (tab === 'replication') {
    return PORTFOLIO_V2_ROUTES.replicationDrafts;
  }
  if (tab === 'operations') {
    return PORTFOLIO_V2_ROUTES.overviewOperations;
  }
  if (tab === 'overview') {
    if (overviewTab === 'operations') {
      return PORTFOLIO_V2_ROUTES.overviewOperations;
    }
    if (overviewTab === 'compare') {
      return PORTFOLIO_V2_ROUTES.overviewCompare;
    }
    return PORTFOLIO_V2_ROUTES.overview;
  }
  if (!tab) {
    if (overviewTab === 'operations') {
      return PORTFOLIO_V2_ROUTES.overviewOperations;
    }
    if (overviewTab === 'compare') {
      return PORTFOLIO_V2_ROUTES.overviewCompare;
    }
  }

  return null;
}

function resolveActiveSection(pathname: string): PortfolioDetailsSection {
  if (pathname === PORTFOLIO_V2_ROUTES.actions) {
    return 'actions';
  }
  if (
    pathname === PORTFOLIO_V2_ROUTES.replication
    || pathname.startsWith(`${PORTFOLIO_V2_ROUTES.replication}/`)
  ) {
    return 'replication';
  }
  return 'overview';
}

export default function PortfolioDetailsRouteLayout({
  children,
}: PortfolioDetailsLayoutProps) {
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
  const selectedPortfolioIDFromUrl = parsePortfolioID(searchParams.get(PORTFOLIO_ID_QUERY_KEY));

  const activeSection = useMemo(
    () => resolveActiveSection(pathname),
    [pathname],
  );
  const providerDetails = useMemo(
    () => ({
      virtual: {
        label: t('portfolio.profiles.providerVirtual'),
        icon: Monitor,
      },
      mock: {
        label: t('portfolio.profiles.providerMock'),
        icon: FlaskConical,
      },
      tbank: {
        label: t('portfolio.profiles.providerTbank'),
        icon: null,
      },
    }),
    [t],
  );
  const providerKey = selectedProfile?.provider?.toLowerCase() ?? '';
  const providerConfig =
    providerKey in providerDetails
      ? providerDetails[providerKey as keyof typeof providerDetails]
      : null;
  const ProviderIcon = providerConfig?.icon ?? CircleHelp;
  const providerName = providerConfig?.label ?? selectedProfile?.provider ?? '';
  const isTbankProvider = providerKey === 'tbank';

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

  const handleSectionChange = useCallback(
    (nextSectionRaw: string) => {
      const nextSection: PortfolioDetailsSection =
        nextSectionRaw === 'actions'
          ? 'actions'
          : nextSectionRaw === 'replication'
              ? 'replication'
              : 'overview';
      const nextPath = SECTION_ROUTES[nextSection];
      if (!nextPath) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('tab');
      nextParams.delete('overview_tab');
      nextParams.delete('replication_tab');
      const query = nextParams.toString();
      const href = query ? `${nextPath}?${query}` : nextPath;
      router.replace(href, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (selectedPortfolioIDFromUrl) {
      return;
    }

    router.replace(PORTFOLIO_V2_ROUTES.profiles, { scroll: false });
  }, [router, selectedPortfolioIDFromUrl]);

  useEffect(() => {
    const legacyTab = searchParams.get('tab');
    const legacyOverviewTab = searchParams.get('overview_tab');
    if (!legacyTab && !legacyOverviewTab) {
      return;
    }

    const resolvedPath = resolveLegacyRoute(legacyTab, legacyOverviewTab);
    if (!resolvedPath) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('tab');
    nextParams.delete('overview_tab');

    const query = nextParams.toString();
    const href = query ? `${resolvedPath}?${query}` : resolvedPath;
    const currentQuery = searchParams.toString();
    const currentHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (href !== currentHref) {
      router.replace(href, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  if (!selectedPortfolioIDFromUrl) {
    return null;
  }

  return (
    <PortfolioDetailsProvider
      value={{
        selectedPortfolioID,
        selectedProfile,
        refreshProfiles,
      }}
    >
      <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
        <Tabs
          value={activeSection}
          onValueChange={handleSectionChange}
          className='min-h-0 min-w-0 flex-1 gap-6'
        >
          <div className='space-y-4'>
            <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start'>
              <div className='flex items-start justify-between gap-4'>
                <div className='space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h1 className='text-3xl font-bold'>
                      {selectedProfile?.name || t('portfolio.details.profileNameFallback')}
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
                    {selectedProfile ? (
                      <span className='inline-flex items-center gap-2'>
                        {isTbankProvider ? (
                          <Image
                            src='/tbank-logo-32x32.png'
                            alt={providerName}
                            width={16}
                            height={16}
                            unoptimized
                            className='size-4 rounded-[3px]'
                          />
                        ) : (
                          <ProviderIcon className='size-4' />
                        )}
                        <span>{t('portfolio.profiles.providerSummary', { provider: providerName })}</span>
                      </span>
                    ) : (
                      t('common.loading')
                    )}
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

              <TabsList className='grid h-auto w-full grid-cols-3 lg:w-auto'>
                <TabsTrigger value='overview'>
                  <Wallet className='size-4' />
                  {t('portfolio.subpages.overview')}
                </TabsTrigger>
                <TabsTrigger value='actions'>
                  <PlayCircle className='size-4' />
                  {t('portfolio.subpages.actions')}
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

          <div className='min-h-0 flex-1 overflow-hidden'>
            {children}
          </div>
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
    </PortfolioDetailsProvider>
  );
}
