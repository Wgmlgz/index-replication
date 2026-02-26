'use client';

import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '@/components/ui/theme-provider';

const ClientAppShell = dynamic(() => import('@/components/client-app-shell'), {
  ssr: false,
  loading: () => <div className='min-h-svh bg-background' />,
});

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
        <div id='app' suppressHydrationWarning>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            enableSystem
            disableTransitionOnChange
          >
            <ClientAppShell>{children}</ClientAppShell>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
