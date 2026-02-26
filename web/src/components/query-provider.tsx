'use client';

import React, { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

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

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: window.localStorage,
      key: QUERY_PERSIST_KEY,
    })
  );

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
