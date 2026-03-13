'use client';

import React, { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

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
    createAsyncStoragePersister({
      storage: {
        getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
        setItem: (key: string, value: string) => {
          window.localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          window.localStorage.removeItem(key);
          return Promise.resolve();
        },
      },
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
      onSuccess={async () => {
        // On reload with persisted cache, force SWR behavior:
        // show hydrated data immediately, then refresh active queries.
        if (!window.localStorage.getItem(QUERY_PERSIST_KEY)) {
          return;
        }
        await queryClient.resumePausedMutations();
        await queryClient.invalidateQueries();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
