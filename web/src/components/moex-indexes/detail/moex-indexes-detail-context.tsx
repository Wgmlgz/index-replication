'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { MoexIndexDetailState } from './moex-indexes-detail.types';

const MoexIndexDetailContext = createContext<MoexIndexDetailState | null>(null);

export function MoexIndexDetailProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: MoexIndexDetailState;
}) {
  return (
    <MoexIndexDetailContext.Provider value={value}>
      {children}
    </MoexIndexDetailContext.Provider>
  );
}

export function useMoexIndexDetailContext() {
  const context = useContext(MoexIndexDetailContext);
  if (!context) {
    throw new Error(
      'useMoexIndexDetailContext must be used within MoexIndexDetailProvider'
    );
  }
  return context;
}
