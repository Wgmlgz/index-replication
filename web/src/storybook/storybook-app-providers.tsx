import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'sonner';

import { ThemeProvider } from '@/components/ui/theme-provider';
import { initI18n } from '@/lib/i18n';

const i18n = initI18n();

export function StorybookAppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60,
            gcTime: 1000 * 60 * 10,
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    void i18n.changeLanguage('en');
  }, []);

  return (
    <ThemeProvider attribute='class' defaultTheme='light' enableSystem={false} disableTransitionOnChange>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster />
        </QueryClientProvider>
      </I18nextProvider>
    </ThemeProvider>
  );
}
