'use client';

import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import moment from 'moment';
import 'moment/locale/ru';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SidebarProvider } from '@/components/ui/sidebar';
import { QueryProvider } from '@/components/query-provider';
import { UserProvider, useUser } from '@/components/user-context';
import { AppSidebar } from '@/components/app-sidebar';
import { FullPageRedirectStatus } from '@/components/full-page-redirect-status';
import { Toaster } from 'sonner';
import { initI18n, setLanguage } from '@/lib/i18n';
import { userSettingsClient } from '@/lib/user-settings-client';
import { hasKeycloakCallbackParams } from '@/lib/keycloak-auth';
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  getSafeNextPath,
  isPublicRoute,
} from '@/lib/routes';

const i18n = initI18n();
const USER_SETTING_LANGUAGE_KEY = 'preferences.language';

function ProtectedPageSkeleton() {
  return (
    <div className='min-h-svh p-6 sm:p-8'>

    </div>
  );
}

function AppFrame({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authState } = useUser();
  const { t, i18n } = useTranslation();
  const isPublic = isPublicRoute(pathname);
  const searchParamsString = searchParams.toString();
  const nextPath = getSafeNextPath(searchParams.get('next'));
  const isLoginCallbackRoute =
    pathname === '/login' && hasKeycloakCallbackParams(searchParamsString);

  useEffect(() => {
    if (!isPublic && authState === 'unauthenticated') {
      const requestedPath = `${pathname}${searchParamsString ? `?${searchParamsString}` : ''
        }`;
      router.replace(`/login?next=${encodeURIComponent(requestedPath)}`);
    }
  }, [authState, isPublic, pathname, router, searchParamsString]);

  useEffect(() => {
    if (isLoginCallbackRoute) {
      return;
    }
    if (pathname === '/login' && authState === 'authenticated') {
      router.replace(nextPath ?? DEFAULT_AUTHENTICATED_ROUTE);
    }
  }, [authState, isLoginCallbackRoute, nextPath, pathname, router]);

  useEffect(() => {
    const lower = (i18n.language || 'en').toLowerCase();
    moment.locale(lower.startsWith('ru') ? 'ru' : 'en');
  }, [i18n.language]);

  useEffect(() => {
    if (authState !== 'authenticated') return;
    let mounted = true;
    const loadPreferredLanguage = async () => {
      try {
        const settings = await userSettingsClient.getSettings();
        if (!mounted) return;
        setLanguage(settings.values?.[USER_SETTING_LANGUAGE_KEY] ?? 'en');
      } catch {
        // Keep currently selected language when settings are unavailable.
      }
    };
    void loadPreferredLanguage();
    return () => {
      mounted = false;
    };
  }, [authState]);

  if (isPublic) {
    if (pathname === '/login' && authState === 'authenticated' && !isLoginCallbackRoute) {
      return null;
    }

    return <div className='min-h-svh'>{children}</div>;
  }

  if (authState === 'restoring') {
    return <ProtectedPageSkeleton />;
  }

  if (authState === 'unauthenticated') {
    return (
      <FullPageRedirectStatus
        title={t('auth.guard.redirectingToLoginTitle')}
        description={t('auth.guard.redirectingToLoginDescription')}
        revealDelayMs={5000}
        fadeInMs={1000}
      />
    );
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      className='min-h-svh'
      style={
        {
          '--sidebar-width': '15rem',
          '--sidebar-width-mobile': '15rem',
        } as CSSProperties
      }
    >
      <AppSidebar variant='sidebar' />
      <div className='flex min-h-0 flex-1 flex-col'>
        <main className='mx-auto min-h-0 w-full px-4 py-8 sm:px-6 lg:px-8'>{children}</main>
      </div>
    </SidebarProvider>
  );
}

export default function ClientAppShell({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryProvider>
        <UserProvider>
          <AppFrame>{children}</AppFrame>
          <Toaster />
        </UserProvider>
      </QueryProvider>
    </I18nextProvider>
  );
}
