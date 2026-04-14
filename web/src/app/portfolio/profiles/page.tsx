'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CircleHelp,
  FlaskConical,
  Monitor,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import type { PortfolioProfile, PortfolioProfileCreateRequest } from '@/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import {
  buildPortfolioHref,
  PORTFOLIO_V2_PROFILES_QUERY_KEY,
  PORTFOLIO_V2_ROUTES,
} from '@/lib/portfolio';

type NormalizedPortfolioProfile = PortfolioProfile & {
  id: number;
  name: string;
  provider: string;
};

function profileCardCornerClasses(index: number, total: number, columns: number): string {
  const safeColumns = Math.max(columns, 1);
  const rowIndex = Math.floor(index / safeColumns);
  const columnIndex = index % safeColumns;
  const isOccupied = (row: number, column: number): boolean => {
    if (row < 0 || column < 0 || column >= safeColumns) {
      return false;
    }
    const cellIndex = (row * safeColumns) + column;
    return cellIndex >= 0 && cellIndex < total;
  };
  const hasUp = isOccupied(rowIndex - 1, columnIndex);
  const hasRight = isOccupied(rowIndex, columnIndex + 1);
  const hasDown = isOccupied(rowIndex + 1, columnIndex);
  const hasLeft = isOccupied(rowIndex, columnIndex - 1);
  const classes: string[] = [];

  if (!hasUp && !hasLeft) {
    classes.push('rounded-tl-lg');
  }
  if (!hasUp && !hasRight) {
    classes.push('rounded-tr-lg');
  }
  if (!hasDown && !hasLeft) {
    classes.push('rounded-bl-lg');
  }
  if (!hasDown && !hasRight) {
    classes.push('rounded-br-lg');
  }

  return classes.join(' ');
}

export default function PortfolioProfilesPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createProvider, setCreateProvider] = useState<'virtual' | 'mock' | 'tbank'>('virtual');
  const [createIsDefault, setCreateIsDefault] = useState(false);
  const [createTbankSandboxAccount, setCreateTbankSandboxAccount] = useState(true);
  const [createAccountID, setCreateAccountID] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NormalizedPortfolioProfile | null>(null);
  const [profileGridColumns, setProfileGridColumns] = useState(1);

  useEffect(() => {
    const syncGridColumns = () => {
      if (window.innerWidth >= 1280) {
        setProfileGridColumns(3);
        return;
      }
      if (window.innerWidth >= 640) {
        setProfileGridColumns(2);
        return;
      }
      setProfileGridColumns(1);
    };

    syncGridColumns();
    window.addEventListener('resize', syncGridColumns);
    return () => {
      window.removeEventListener('resize', syncGridColumns);
    };
  }, []);

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }

    return fallback;
  }, []);

  const profilesQuery = useQuery<PortfolioProfile[]>({
    queryKey: PORTFOLIO_V2_PROFILES_QUERY_KEY,
    queryFn: async () => (await portfolioApi.mePortfoliosGet()).data ?? [],
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: PortfolioProfileCreateRequest) =>
      (await portfolioApi.mePortfoliosPost(payload)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PORTFOLIO_V2_PROFILES_QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (portfolioID: number) => {
      await portfolioApi.mePortfoliosIdDelete(portfolioID);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PORTFOLIO_V2_PROFILES_QUERY_KEY });
    },
  });

  const toggleDefaultMutation = useMutation({
    mutationFn: async ({ portfolioID, isDefault }: { portfolioID: number; isDefault: boolean }) => {
      await portfolioApi.mePortfoliosIdPatch(portfolioID, { is_default: isDefault });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PORTFOLIO_V2_PROFILES_QUERY_KEY });
    },
  });

  const profiles = useMemo(
    () =>
      (profilesQuery.data ?? []).filter(
        (profile): profile is NormalizedPortfolioProfile =>
          typeof profile.id === 'number' &&
          profile.id > 0 &&
          typeof profile.name === 'string' &&
          typeof profile.provider === 'string',
      ),
    [profilesQuery.data],
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

  const resetCreateForm = useCallback(() => {
    setCreateName('');
    setCreateProvider('virtual');
    setCreateIsDefault(false);
    setCreateTbankSandboxAccount(true);
    setCreateAccountID('');
  }, []);

  const onCreateOpenChange = useCallback(
    (nextOpen: boolean) => {
      setCreateOpen(nextOpen);
      if (!nextOpen) {
        resetCreateForm();
      }
    },
    [resetCreateForm],
  );

  const onCreateProfile = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedName = createName.trim();
      if (!trimmedName) {
        setError(t('portfolio.errors.profileNameRequired'));
        return;
      }

      const payload: PortfolioProfileCreateRequest = {
        provider: createProvider,
        name: trimmedName,
        is_default: createIsDefault,
        config: {},
      };
      if (createProvider === 'tbank') {
        if (createTbankSandboxAccount) {
          payload.config = { create_sandbox_account: true };
        } else {
          const trimmedAccountID = createAccountID.trim();
          if (!trimmedAccountID) {
            setError(t('portfolio.errors.profileAccountIDRequired'));
            return;
          }
          payload.config = { account_id: trimmedAccountID };
        }
      }

      try {
        setError('');
        await createMutation.mutateAsync(payload);
        onCreateOpenChange(false);
      } catch (err) {
        setError(parseErrorMessage(err, t('portfolio.errors.createProfile')));
      }
    },
    [
      createAccountID,
      createIsDefault,
      createMutation,
      createName,
      createProvider,
      createTbankSandboxAccount,
      onCreateOpenChange,
      parseErrorMessage,
      t,
    ],
  );

  const onDeleteProfile = useCallback(
    async (profile: NormalizedPortfolioProfile) => {
      try {
        setError('');
        await deleteMutation.mutateAsync(profile.id);
        setDeleteTarget(null);
      } catch (err) {
        setError(parseErrorMessage(err, t('portfolio.errors.deleteProfile')));
      }
    },
    [deleteMutation, parseErrorMessage, t],
  );

  const onToggleDefault = useCallback(
    async (profile: NormalizedPortfolioProfile, isDefault: boolean) => {
      try {
        setError('');
        await toggleDefaultMutation.mutateAsync({
          portfolioID: profile.id,
          isDefault,
        });
      } catch (err) {
        setError(parseErrorMessage(err, t('portfolio.errors.updateProfile')));
      }
    },
    [parseErrorMessage, t, toggleDefaultMutation],
  );

  const hasDefaultProfile = useMemo(
    () => profiles.some(profile => profile.is_default),
    [profiles],
  );

  const formatDateTime = (value?: string) => {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
      <div className='flex items-start justify-between gap-4'>
        <div className='space-y-2'>
          <h1 className='text-3xl font-bold'>{t('portfolio.profiles.title')}</h1>
          <p className='text-muted-foreground text-sm'>{t('portfolio.profiles.description')}</p>
        </div>

        <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className='size-4' />
              {t('portfolio.profiles.createButton')}
            </Button>
          </DialogTrigger>
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>{t('portfolio.profiles.createDialogTitle')}</DialogTitle>
              <DialogDescription>{t('portfolio.profiles.createDialogDescription')}</DialogDescription>
            </DialogHeader>

            <form
              className='space-y-4'
              onSubmit={event => {
                void onCreateProfile(event);
              }}
            >
              <div className='grid gap-2'>
                <Label htmlFor='portfolio-create-name'>
                  {t('portfolio.profiles.createNameLabel')}
                </Label>
                <Input
                  id='portfolio-create-name'
                  value={createName}
                  onChange={event => setCreateName(event.target.value)}
                  placeholder={t('portfolio.profiles.createNamePlaceholder')}
                  disabled={createMutation.isPending}
                />
              </div>

              <div className='grid gap-2'>
                <Label htmlFor='portfolio-create-provider'>
                  {t('portfolio.profiles.createProviderLabel')}
                </Label>
                <select
                  id='portfolio-create-provider'
                  className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                  value={createProvider}
                  onChange={event => {
                    const nextProvider = event.target.value as 'virtual' | 'mock' | 'tbank';
                    setCreateProvider(nextProvider);
                    if (nextProvider !== 'tbank') {
                      setCreateTbankSandboxAccount(true);
                      setCreateAccountID('');
                    }
                  }}
                  disabled={createMutation.isPending}
                >
                  <option value='virtual'>{t('portfolio.profiles.providerVirtual')}</option>
                  <option value='mock'>{t('portfolio.profiles.providerMock')}</option>
                  <option value='tbank'>{t('portfolio.profiles.providerTbank')}</option>
                </select>
              </div>

              {createProvider === 'tbank' ? (
                <div className='grid gap-3'>
                  <Label>{t('portfolio.profiles.createAccountModeLabel')}</Label>
                  <label className='flex items-center gap-2 text-sm'>
                    <input
                      type='radio'
                      name='portfolio-create-account-mode'
                      checked={createTbankSandboxAccount}
                      onChange={() => setCreateTbankSandboxAccount(true)}
                      disabled={createMutation.isPending}
                    />
                    <span>{t('portfolio.profiles.createSandboxAccountOption')}</span>
                  </label>
                  <label className='flex items-center gap-2 text-sm'>
                    <input
                      type='radio'
                      name='portfolio-create-account-mode'
                      checked={!createTbankSandboxAccount}
                      onChange={() => setCreateTbankSandboxAccount(false)}
                      disabled={createMutation.isPending}
                    />
                    <span>{t('portfolio.profiles.createExistingAccountOption')}</span>
                  </label>

                  {!createTbankSandboxAccount ? (
                    <div className='grid gap-2'>
                      <Label htmlFor='portfolio-create-account-id'>
                        {t('portfolio.profiles.createAccountIDLabel')}
                      </Label>
                      <Input
                        id='portfolio-create-account-id'
                        value={createAccountID}
                        onChange={event => setCreateAccountID(event.target.value)}
                        placeholder={t('portfolio.profiles.createAccountIDPlaceholder')}
                        disabled={createMutation.isPending}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <label className='flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={createIsDefault}
                  onChange={event => setCreateIsDefault(event.target.checked)}
                  disabled={createMutation.isPending}
                />
                <span>{t('portfolio.profiles.createDefaultLabel')}</span>
              </label>

              <DialogFooter>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onCreateOpenChange(false)}
                  disabled={createMutation.isPending}
                >
                  {t('portfolio.profiles.cancelButton')}
                </Button>
                <Button type='submit' disabled={createMutation.isPending}>
                  {t('portfolio.profiles.createSubmit')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {profilesQuery.error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('portfolio.errors.loadProfiles')}</AlertDescription>
        </Alert>
      ) : null}

      <Card className='min-h-0 flex-1 overflow-hidden py-0'>
        <CardContent className='min-h-0 flex-1 space-y-3 overflow-y-auto py-6'>
          {profilesQuery.isLoading ? (
            <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
          ) : null}

          {!profilesQuery.isLoading && profiles.length === 0 ? (
            <p className='text-sm text-muted-foreground'>{t('portfolio.selector.noProfiles')}</p>
          ) : null}

          {profiles.length > 0 ? (
            <div className='grid gap-0 sm:grid-cols-2 xl:grid-cols-3'>
              {profiles.map((profile, index) => {
                const providerKey = profile.provider.toLowerCase() as keyof typeof providerDetails;
                const providerConfig = providerDetails[providerKey];
                const ProviderIcon = providerConfig?.icon ?? CircleHelp;
                const providerName = providerConfig?.label ?? profile.provider;
                const isTbank = providerKey === 'tbank';
                const cornerClasses = profileCardCornerClasses(index, profiles.length, profileGridColumns);

                return (
                  <div
                    key={profile.id}
                    className={`-ml-px -mt-px flex min-h-40 flex-col gap-4 border p-4 ${cornerClasses}`}
                  >
                    <div className='flex items-start justify-between gap-2'>
                      <p className='font-medium'>{profile.name}</p>
                      <div className='flex items-center gap-1'>
                        {profile.is_default ? (
                          <>
                            <span className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'>
                              <Star className='size-3' />
                              {t('portfolio.profiles.defaultLabelShort')}
                            </span>
                            <Button
                              type='button'
                              size='icon'
                              variant='ghost'
                              className='size-6'
                              onClick={() => {
                                void onToggleDefault(profile, false);
                              }}
                              aria-label={t('portfolio.profiles.removeDefaultAriaLabel', {
                                name: profile.name,
                              })}
                              disabled={toggleDefaultMutation.isPending}
                            >
                              <X className='size-3' />
                            </Button>
                          </>
                        ) : null}
                        {!profile.is_default && !hasDefaultProfile ? (
                          <button
                            type='button'
                            className='inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50'
                            onClick={() => {
                              void onToggleDefault(profile, true);
                            }}
                            aria-label={t('portfolio.profiles.setDefaultAriaLabel', {
                              name: profile.name,
                            })}
                            disabled={toggleDefaultMutation.isPending}
                          >
                            {t('portfolio.profiles.setDefaultButton')}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className='space-y-1 text-sm text-muted-foreground'>
                      <p className='inline-flex items-center gap-2'>
                        {isTbank ? (
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
                      </p>
                    </div>

                    <div className='mt-auto flex items-end justify-between gap-3'>
                      <p className='text-xs text-muted-foreground'>
                        {t('portfolio.profiles.updatedLabel')}: {formatDateTime(profile.updated_at)}
                      </p>
                      <ButtonGroup className='shrink-0'>
                        <Button asChild size='default' variant='outline'>
                          <Link
                            href={buildPortfolioHref(PORTFOLIO_V2_ROUTES.overview, profile.id)}
                            aria-label={t('portfolio.profiles.openAriaLabel', {
                              name: profile.name,
                            })}
                            className='inline-flex items-center gap-1'
                          >
                            {t('portfolio.profiles.overviewButton')}
                            <ArrowUpRight className='size-4' />
                          </Link>
                        </Button>
                        <Button
                          type='button'
                          size='icon'
                          variant='outline'
                          onClick={() => setDeleteTarget(profile)}
                          aria-label={t('portfolio.profiles.deleteAriaLabel', {
                            name: profile.name,
                          })}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </ButtonGroup>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('portfolio.profiles.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('portfolio.profiles.deleteConfirmDescription', {
                name: deleteTarget?.name || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('portfolio.profiles.cancelButton')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  void onDeleteProfile(deleteTarget);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {t('portfolio.profiles.deleteConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
