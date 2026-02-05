'use client';

import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Persister } from '@tanstack/query-persist-client-core';

const QUERY_PERSIST_KEY = 'index-replication-query-cache';
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: ONE_DAY_MS,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const [persister, setPersister] = useState<Persister | null>(null);

  useEffect(() => {
    setPersister(
      createSyncStoragePersister({
        storage: window.localStorage,
        key: QUERY_PERSIST_KEY,
      })
    );
  }, []);

  if (!persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY_MS,
        buster: 'v1',
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
