'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Plus, Trash2 } from 'lucide-react';
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

export default function PortfolioProfilesPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createProvider, setCreateProvider] = useState<'virtual' | 'mock' | 'tbank'>('virtual');
  const [createIsDefault, setCreateIsDefault] = useState(false);
  const [createAccountID, setCreateAccountID] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NormalizedPortfolioProfile | null>(null);

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

  const resetCreateForm = useCallback(() => {
    setCreateName('');
    setCreateProvider('virtual');
    setCreateIsDefault(false);
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
      if (createProvider === 'tbank' && createAccountID.trim()) {
        payload.config = { account_id: createAccountID.trim() };
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
                  onChange={event =>
                    setCreateProvider(event.target.value as 'virtual' | 'mock' | 'tbank')
                  }
                  disabled={createMutation.isPending}
                >
                  <option value='virtual'>{t('portfolio.profiles.providerVirtual')}</option>
                  <option value='mock'>{t('portfolio.profiles.providerMock')}</option>
                  <option value='tbank'>{t('portfolio.profiles.providerTbank')}</option>
                </select>
              </div>

              {createProvider === 'tbank' ? (
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
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className='flex min-h-40 flex-col justify-between gap-4 rounded-lg border p-4'
                >
                  <div className='space-y-3'>
                    <div className='space-y-1'>
                      <p className='font-medium'>{profile.name}</p>
                      <p className='text-xs text-muted-foreground'>ID: {profile.id}</p>
                    </div>
                    <div className='space-y-1 text-sm text-muted-foreground'>
                      <p>
                        {t('portfolio.profiles.providerLabel')}: {profile.provider}
                      </p>
                      <p>
                        {t('portfolio.profiles.defaultLabelShort')}:{' '}
                        {profile.is_default
                          ? t('portfolio.profiles.defaultYes')
                          : t('portfolio.profiles.defaultNo')}
                      </p>
                      <p>
                        {t('portfolio.profiles.actionsLabel')}:{' '}
                        {profile.capabilities?.actions?.length ?? 0}
                      </p>
                      <p>
                        {t('portfolio.profiles.updatedLabel')}: {formatDateTime(profile.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className='flex justify-end gap-2'>
                    <Button asChild size='sm' variant='outline'>
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
                  </div>
                </div>
              ))}
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
