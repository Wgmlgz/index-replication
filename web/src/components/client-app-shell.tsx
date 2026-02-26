'use client';

import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import moment from 'moment';
import 'moment/locale/ru';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryProvider } from '@/components/query-provider';
import { UserProvider, useUser } from '@/components/user-context';
import { AppSidebar } from '@/components/app-sidebar';
import { Toaster } from 'sonner';
import { initI18n } from '@/lib/i18n';
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  getSafeNextPath,
  isPublicRoute,
} from '@/lib/routes';

moment.locale('ru');
const i18n = initI18n();

function FullPageStatus({ title, description }: { title: string; description: string }) {
  return (
    <div className='flex min-h-svh items-center justify-center p-6 text-center'>
      <div className='space-y-2'>
        <h1 className='text-xl font-semibold'>{title}</h1>
        <p className='text-sm text-muted-foreground'>{description}</p>
      </div>
    </div>
  );
}

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
  const { t } = useTranslation();
  const isPublic = isPublicRoute(pathname);
  const searchParamsString = searchParams.toString();
  const nextPath = getSafeNextPath(searchParams.get('next'));

  useEffect(() => {
    if (!isPublic && authState === 'unauthenticated') {
      const requestedPath = `${pathname}${
        searchParamsString ? `?${searchParamsString}` : ''
      }`;
      router.replace(`/login?next=${encodeURIComponent(requestedPath)}`);
    }
  }, [authState, isPublic, pathname, router, searchParamsString]);

  useEffect(() => {
    if (pathname === '/login' && authState === 'authenticated') {
      router.replace(nextPath ?? DEFAULT_AUTHENTICATED_ROUTE);
    }
  }, [authState, nextPath, pathname, router]);

  if (isPublic) {
    if (pathname === '/login' && authState === 'authenticated') {
      return (
        <FullPageStatus
          title={t('auth.guard.redirectingToAppTitle')}
          description={t('auth.guard.redirectingToAppDescription')}
        />
      );
    }

    return <div className='min-h-svh'>{children}</div>;
  }

  if (authState === 'restoring') {
    return <ProtectedPageSkeleton />;
  }

  if (authState === 'unauthenticated') {
    return (
      <FullPageStatus
        title={t('auth.guard.redirectingToLoginTitle')}
        description={t('auth.guard.redirectingToLoginDescription')}
      />
    );
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      className='min-h-svh'
      style={
        {
          '--sidebar-width': '20rem',
          '--sidebar-width-mobile': '20rem',
        } as CSSProperties
      }
    >
      <AppSidebar variant='sidebar' />
      <div className='flex flex-1 flex-col'>
        <main className='mx-auto w-full px-4 py-8 sm:px-6 lg:px-8'>{children}</main>
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
