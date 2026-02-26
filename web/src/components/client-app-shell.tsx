'use client';

import moment from 'moment';
import 'moment/locale/ru';
import { I18nextProvider } from 'react-i18next';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { QueryProvider } from '@/components/query-provider';
import { UserProvider } from '@/components/user-context';
import { AppSidebar } from '@/components/app-sidebar';
import { Toaster } from 'sonner';
import { initI18n } from '@/lib/i18n';

moment.locale('ru');
const i18n = initI18n();

export default function ClientAppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <I18nextProvider i18n={i18n}>
      <SidebarProvider
        defaultOpen={false}
        className='min-h-svh'
        style={{
          "--sidebar-width": "20rem",
          "--sidebar-width-mobile": "20rem",
        } as React.CSSProperties}
      >
        <QueryProvider>
          <UserProvider>
            <AppSidebar variant='sidebar' />
              <div className='flex flex-1 flex-col'>
                <main className='mx-auto w-full px-4 py-8 sm:px-6 lg:px-8'>
                  {children}
                </main>
              </div>
            <Toaster />
          </UserProvider>
        </QueryProvider>
      </SidebarProvider>
    </I18nextProvider>
  );
}
