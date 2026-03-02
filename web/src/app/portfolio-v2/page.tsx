'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import type {
  PortfolioProfile,
  PortfolioProfileCreateRequest,
} from '@/api-client';
import { PortfolioAnalyticsSection } from '@/app/portfolio-v2/portfolio-analytics-section';
import { PortfolioCard } from '@/app/portfolio-v2/portfolio-card';
import { useUrlStateSync } from '@/lib/url-state/use-url-state-sync';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const PORTFOLIO_ID_QUERY_KEY = 'portfolio_id';
const PORTFOLIO_PROFILES_QUERY_KEY = ['portfolio-v2', 'profiles'];

type PortfolioUrlState = {
  portfolioID?: number;
};

const parsePortfolioUrlState = (searchParams: URLSearchParams): PortfolioUrlState => {
  const rawID = searchParams.get(PORTFOLIO_ID_QUERY_KEY)?.trim();
  if (!rawID) {
    return {};
  }
  const parsedID = Number.parseInt(rawID, 10);
  if (!Number.isFinite(parsedID) || parsedID <= 0) {
    return {};
  }
  return { portfolioID: parsedID };
};

export default function PortfolioV2Page() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();

  const parsedUrl = useMemo(
    () => parsePortfolioUrlState(new URLSearchParams(urlKey)),
    [urlKey],
  );

  const [selectedPortfolioID, setSelectedPortfolioID] = useState<number | null>(
    () => parsedUrl.portfolioID ?? null,
  );
  const [newProvider, setNewProvider] = useState<'mock' | 'tbank'>('mock');
  const [newName, setNewName] = useState('');
  const [newAccountID, setNewAccountID] = useState('');
  const [newIsDefault, setNewIsDefault] = useState(false);
  const [error, setError] = useState('');

  const portfoliosQuery = useQuery<PortfolioProfile[]>({
    queryKey: PORTFOLIO_PROFILES_QUERY_KEY,
    queryFn: async () => (await portfolioApi.mePortfoliosGet()).data ?? [],
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const profiles = useMemo(
    () => portfoliosQuery.data ?? [],
    [portfoliosQuery.data],
  );
  const normalizedProfiles = useMemo(
    () =>
      profiles.filter(
        (
          profile,
        ): profile is PortfolioProfile & {
          id: number;
          name: string;
          provider: string;
        } =>
          typeof profile.id === 'number' &&
          profile.id > 0 &&
          typeof profile.name === 'string' &&
          typeof profile.provider === 'string',
      ),
    [profiles],
  );

  const effectiveSelectedPortfolioID = useMemo(() => {
    if (normalizedProfiles.length === 0) {
      return null;
    }
    const selectedExists = normalizedProfiles.some(
      profile => profile.id === selectedPortfolioID,
    );
    if (selectedExists) {
      return selectedPortfolioID;
    }
    const fallbackProfile =
      normalizedProfiles.find(profile => profile.is_default) ?? normalizedProfiles[0];
    return fallbackProfile?.id ?? null;
  }, [normalizedProfiles, selectedPortfolioID]);

  const urlStateKey = useMemo(
    () => JSON.stringify({ effectiveSelectedPortfolioID }),
    [effectiveSelectedPortfolioID],
  );

  useUrlStateSync({
    pathname,
    urlKey,
    stateKey: urlStateKey,
    parse: parsePortfolioUrlState,
    applyParsedState: next => {
      setSelectedPortfolioID(next.portfolioID ?? null);
    },
    buildSearchParams: () => {
      const next = new URLSearchParams(window.location.search);
      next.delete(PORTFOLIO_ID_QUERY_KEY);
      if (effectiveSelectedPortfolioID) {
        next.set(PORTFOLIO_ID_QUERY_KEY, String(effectiveSelectedPortfolioID));
      }
      return next;
    },
  });

  const selectedProfile = useMemo(
    () =>
      normalizedProfiles.find(profile => profile.id === effectiveSelectedPortfolioID) ?? null,
    [effectiveSelectedPortfolioID, normalizedProfiles],
  );

  const parseErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  };

  const createMutation = useMutation({
    mutationFn: async (payload: PortfolioProfileCreateRequest) =>
      (await portfolioApi.mePortfoliosPost(payload)).data,
    onSuccess: async profile => {
      setError('');
      setNewName('');
      setNewAccountID('');
      setNewIsDefault(false);
      if (typeof profile.id === 'number' && profile.id > 0) {
        setSelectedPortfolioID(profile.id);
      }
      await queryClient.invalidateQueries({ queryKey: PORTFOLIO_PROFILES_QUERY_KEY });
    },
    onError: err => {
      setError(parseErrorMessage(err, t('portfolioV2.errors.createProfile')));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (portfolioID: number) => {
      await portfolioApi.mePortfoliosIdDelete(portfolioID);
    },
    onSuccess: async () => {
      setError('');
      await queryClient.invalidateQueries({ queryKey: PORTFOLIO_PROFILES_QUERY_KEY });
    },
    onError: err => {
      setError(parseErrorMessage(err, t('portfolioV2.errors.deleteProfile')));
    },
  });

  const onCreateProfile = () => {
    const normalizedName = newName.trim();
    if (!normalizedName) {
      setError(t('portfolioV2.errors.profileNameRequired'));
      return;
    }

    const payload: PortfolioProfileCreateRequest = {
      provider: newProvider,
      name: normalizedName,
      is_default: newIsDefault,
      config:
        newProvider === 'tbank' && newAccountID.trim()
          ? { account_id: newAccountID.trim() }
          : {},
    };
    createMutation.mutate(payload);
  };

  const onDeleteSelectedProfile = () => {
    if (!effectiveSelectedPortfolioID) {
      return;
    }
    deleteMutation.mutate(effectiveSelectedPortfolioID);
  };

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>{t('portfolioV2.title')}</h1>
        <p className='text-muted-foreground'>{t('portfolioV2.description')}</p>
      </div>

      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle>{t('portfolioV2.selector.title')}</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          {portfoliosQuery.isLoading ? (
            <div className='space-y-2'>
              <Skeleton className='h-8 w-full' />
              <Skeleton className='h-8 w-full' />
            </div>
          ) : (
            <>
              <div className='grid gap-2'>
                <Label htmlFor='portfolio-v2-selector'>
                  {t('portfolioV2.selector.label')}
                </Label>
                <select
                  id='portfolio-v2-selector'
                  className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                  value={effectiveSelectedPortfolioID ?? ''}
                  onChange={event =>
                    setSelectedPortfolioID(
                      event.target.value ? Number.parseInt(event.target.value, 10) : null,
                    )
                  }
                >
                  <option value=''>{t('portfolioV2.selector.emptyOption')}</option>
                  {normalizedProfiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.provider})
                      {profile.is_default ? ` • ${t('portfolioV2.selector.defaultTag')}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex gap-2'>
                <Button
                  type='button'
                  variant='destructive'
                  onClick={onDeleteSelectedProfile}
                  disabled={!effectiveSelectedPortfolioID || deleteMutation.isPending}
                >
                  {t('portfolioV2.selector.deleteButton')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() =>
                    void queryClient.invalidateQueries({
                      queryKey: PORTFOLIO_PROFILES_QUERY_KEY,
                    })
                  }
                >
                  {t('portfolioV2.selector.refreshButton')}
                </Button>
              </div>
            </>
          )}

          <div className='grid gap-3 rounded-md border p-3'>
            <div className='text-sm font-medium'>{t('portfolioV2.selector.createTitle')}</div>
            <div className='grid gap-2 sm:grid-cols-4'>
              <div className='grid gap-2'>
                <Label htmlFor='portfolio-v2-provider'>
                  {t('portfolioV2.selector.provider')}
                </Label>
                <select
                  id='portfolio-v2-provider'
                  className='border-input bg-background h-9 rounded-md border px-3 text-sm'
                  value={newProvider}
                  onChange={event => setNewProvider(event.target.value as 'mock' | 'tbank')}
                >
                  <option value='mock'>mock</option>
                  <option value='tbank'>tbank</option>
                </select>
              </div>

              <div className='grid gap-2 sm:col-span-2'>
                <Label htmlFor='portfolio-v2-name'>
                  {t('portfolioV2.selector.name')}
                </Label>
                <Input
                  id='portfolio-v2-name'
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                  placeholder={t('portfolioV2.selector.namePlaceholder')}
                />
              </div>

              <label className='flex items-end gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={newIsDefault}
                  onChange={event => setNewIsDefault(event.target.checked)}
                />
                {t('portfolioV2.selector.isDefault')}
              </label>
            </div>

            {newProvider === 'tbank' ? (
              <div className='grid gap-2'>
                <Label htmlFor='portfolio-v2-account-id'>
                  {t('portfolioV2.selector.accountID')}
                </Label>
                <Input
                  id='portfolio-v2-account-id'
                  value={newAccountID}
                  onChange={event => setNewAccountID(event.target.value)}
                  placeholder={t('portfolioV2.selector.accountIDPlaceholder')}
                />
              </div>
            ) : null}

            <div>
              <Button
                type='button'
                onClick={onCreateProfile}
                disabled={createMutation.isPending}
              >
                {t('portfolioV2.selector.createButton')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6'>
        <div className='min-h-0'>
          <PortfolioAnalyticsSection
            portfolioID={effectiveSelectedPortfolioID}
            portfolioName={selectedProfile?.name || ''}
          />
        </div>
        <div className='min-h-0'>
          <PortfolioCard
            portfolioID={effectiveSelectedPortfolioID}
            profile={selectedProfile}
          />
        </div>
      </div>
    </div>
  );
}
