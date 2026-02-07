'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useMoexIndexes } from './use-moex-indexes';
import type { MoexIndexesState } from './use-moex-indexes.types';

const MoexIndexesContext = createContext<MoexIndexesState | null>(null);

export function MoexIndexesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = useMoexIndexes();
  return (
    <MoexIndexesContext.Provider value={value}>
      {children}
    </MoexIndexesContext.Provider>
  );
}

export function useMoexIndexesContext() {
  const context = useContext(MoexIndexesContext);
  if (!context) {
    throw new Error('useMoexIndexesContext must be used within MoexIndexesProvider');
  }
  return context;
}
