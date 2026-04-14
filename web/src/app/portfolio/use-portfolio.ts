'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

import type {
  PortfolioProfile,
  PortfolioProfileCreateRequest,
} from '@/api-client';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import {
  parsePortfolioUrlState,
  PORTFOLIO_ID_QUERY_KEY,
  PORTFOLIO_V2_PROFILES_QUERY_KEY,
} from '@/lib/portfolio';
import { useUrlStateSync } from '@/lib/url-state/use-url-state-sync';

export type PortfolioReplicationConfig = {
  is_enabled: boolean;
  benchmark_secid: string | null;
  mode_key: string;
  mode_params: Record<string, unknown>;
  excluded_tickers: string[];
  updated_at: string;
};

export type NormalizedPortfolioProfile = Omit<PortfolioProfile, 'id' | 'name' | 'provider' | 'replication'> & {
  id: number;
  name: string;
  provider: string;
  replication: PortfolioReplicationConfig | null;
};

function normalizeProfiles(profiles: PortfolioProfile[]): NormalizedPortfolioProfile[] {
  const normalized: NormalizedPortfolioProfile[] = [];
  for (const profile of profiles) {
    if (
      typeof profile.id !== 'number' ||
      profile.id <= 0 ||
      typeof profile.name !== 'string' ||
      typeof profile.provider !== 'string'
    ) {
      continue;
    }
    normalized.push({
      ...profile,
      id: profile.id,
      name: profile.name,
      provider: profile.provider,
      replication: normalizeReplicationConfig((profile as { replication?: unknown }).replication),
    });
  }
  return normalized;
}

function normalizeReplicationConfig(value: unknown): PortfolioReplicationConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const modeParams = isRecord(value.mode_params) ? value.mode_params : {};
  const excludedTickers = Array.isArray(value.excluded_tickers)
    ? value.excluded_tickers.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    is_enabled: value.is_enabled === true,
    benchmark_secid:
      typeof value.benchmark_secid === 'string' && value.benchmark_secid.trim().length > 0
        ? value.benchmark_secid.trim()
        : null,
    mode_key: typeof value.mode_key === 'string' && value.mode_key.trim().length > 0
      ? value.mode_key.trim()
      : 'full',
    mode_params: modeParams,
    excluded_tickers: excludedTickers,
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function usePortfolio() {
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
  const [error, setError] = useState('');

  const profilesQuery = useQuery<PortfolioProfile[]>({
    queryKey: PORTFOLIO_V2_PROFILES_QUERY_KEY,
    queryFn: async () => (await portfolioApi.mePortfoliosGet()).data ?? [],
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const profiles = useMemo(
    () => normalizeProfiles(profilesQuery.data ?? []),
    [profilesQuery.data],
  );

  const effectiveSelectedPortfolioID = selectedPortfolioID;

  const selectedProfile = useMemo(
    () => profiles.find(profile => profile.id === effectiveSelectedPortfolioID) ?? null,
    [effectiveSelectedPortfolioID, profiles],
  );

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

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }

    return fallback;
  }, []);

  const refreshProfiles = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: PORTFOLIO_V2_PROFILES_QUERY_KEY });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (payload: PortfolioProfileCreateRequest) =>
      (await portfolioApi.mePortfoliosPost(payload)).data,
    onSuccess: async profile => {
      setError('');
      if (typeof profile.id === 'number' && profile.id > 0) {
        setSelectedPortfolioID(profile.id);
      }
      await refreshProfiles();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (portfolioID: number) => {
      await portfolioApi.mePortfoliosIdDelete(portfolioID);
    },
    onSuccess: async () => {
      setError('');
      await refreshProfiles();
    },
  });

  const createProfile = useCallback(
    async (payload: PortfolioProfileCreateRequest) => {
      try {
        setError('');
        await createMutation.mutateAsync(payload);
        return true;
      } catch (err) {
        setError(parseErrorMessage(err, t('portfolio.errors.createProfile')));
        return false;
      }
    },
    [createMutation, parseErrorMessage, t],
  );

  const deleteSelectedProfile = useCallback(async () => {
    if (!effectiveSelectedPortfolioID) {
      return false;
    }

    try {
      setError('');
      await deleteMutation.mutateAsync(effectiveSelectedPortfolioID);
      return true;
    } catch (err) {
      setError(parseErrorMessage(err, t('portfolio.errors.deleteProfile')));
      return false;
    }
  }, [deleteMutation, effectiveSelectedPortfolioID, parseErrorMessage, t]);

  return {
    error,
    setError,
    pathname,
    profiles,
    profilesQuery,
    selectedPortfolioID: effectiveSelectedPortfolioID,
    selectedProfile,
    setSelectedPortfolioID,
    refreshProfiles,
    createProfile,
    createMutation,
    deleteSelectedProfile,
    deleteMutation,
  };
}
