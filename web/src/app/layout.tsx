'use client';

import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import moment from 'moment';
import 'moment/locale/ru';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { I18nextProvider } from 'react-i18next';
import { initI18n } from '@/lib/i18n';

import { UserProvider } from '../components/user-context';
import { SidebarProvider } from '@/components/ui/sidebar';
import Header, { AppSidebar } from '@/components/header';
import { QueryProvider } from '@/components/query-provider';

moment.locale('ru');
const i18n = initI18n();

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en' suppressHydrationWarning>
      {/* <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"></meta> */}
      <meta name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div id="app">
          <I18nextProvider i18n={i18n}>
            <SidebarProvider
              defaultOpen={false}
              style={{
                "--sidebar-width": "20rem",
                "--sidebar-width-mobile": "20rem",
              } as React.CSSProperties}
            >
              <QueryProvider>
                <UserProvider>
                  <AppSidebar variant="inset" />
                  <Toaster />
                  <ThemeProvider
                    attribute='class'
                    defaultTheme='system'
                    enableSystem
                    disableTransitionOnChange
                  >

                    <div className='w-full'>
                      <Header />
                      <div className='min-h-[calc(100svh-65px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'>
                        <main className=' mx-auto px-4 sm:px-6 lg:px-8 py-8'>
                          {children}
                        </main>
                      </div>
                    </div>
                  </ThemeProvider>
                </UserProvider>
              </QueryProvider>
            </SidebarProvider>
          </I18nextProvider>
        </div>
      </body>
    </html>
  );
}
