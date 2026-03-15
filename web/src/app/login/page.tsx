'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { FullPageRedirectStatus } from '@/components/full-page-redirect-status';
import { useUser } from '@/components/user-context';
import { usersApi } from '@/lib/api';
import {
  beginKeycloakLogin,
  consumeKeycloakLoginCallback,
  isKeycloakAuthConfigured,
} from '@/lib/keycloak-auth';
import { DEFAULT_AUTHENTICATED_ROUTE, getSafeNextPath } from '@/lib/routes';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function Page() {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useUser();
  const searchParamsString = searchParams.toString();

  const onLoginSuccess = useCallback(async (): Promise<boolean> => {
    setError('');
    const nextPath = getSafeNextPath(searchParams.get('next'));
    const redirectTarget = nextPath ?? DEFAULT_AUTHENTICATED_ROUTE;

    // Wait for /me to succeed before navigation.
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await usersApi.meGet();
        await refreshUser();
        router.replace(redirectTarget);
        return true;
      } catch {
      }
      await sleep(250);
    }

    setError(t('auth.login.keycloak.profileNotReady'));
    return false;
  }, [refreshUser, router, searchParams, t]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const hasKeycloakCallbackParams =
      params.has('code') || params.has('state') || params.has('error');
    if (!hasKeycloakCallbackParams) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setError('');
      try {
        const handled = await consumeKeycloakLoginCallback(params);
        if (handled) {
          await onLoginSuccess();
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const fallback = t('auth.login.keycloak.callbackError');
        if (err instanceof Error && err.message) {
          setError(err.message);
        } else {
          setError(fallback);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [onLoginSuccess, searchParamsString, t]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const hasKeycloakCallbackParams =
      params.has('code') || params.has('state') || params.has('error');
    if (hasKeycloakCallbackParams) {
      return;
    }

    const run = async () => {
      if (!isKeycloakAuthConfigured()) {
        setError(t('auth.login.keycloak.configError'));
        return;
      }

      setError('');
      const nextPath = getSafeNextPath(params.get('next'));
      const redirectTarget = nextPath ?? DEFAULT_AUTHENTICATED_ROUTE;
      try {
        await beginKeycloakLogin(redirectTarget);
      } catch (err) {
        if (err instanceof Error && err.message) {
          setError(err.message);
        } else {
          setError(t('auth.login.keycloak.callbackError'));
        }
      }
    };

    void run();
  }, [searchParamsString, t]);

  return (
    <FullPageRedirectStatus
      title={error ? t('common.error') : t('auth.guard.redirectingToLoginTitle')}
      description={error || t('auth.login.keycloak.submitting')}
      revealDelayMs={error ? 2000 : 5000}
      fadeInMs={error ? 1000 : 1000}
    />
  );
}
