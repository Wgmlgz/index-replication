'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { MoexIndexListState } from './use-moex-indexes.types';

const MoexIndexListContext = createContext<MoexIndexListState | null>(null);

export function MoexIndexListProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: MoexIndexListState;
}) {
  return (
    <MoexIndexListContext.Provider value={value}>
      {children}
    </MoexIndexListContext.Provider>
  );
}

export function useMoexIndexListContext() {
  const context = useContext(MoexIndexListContext);
  if (!context) {
    throw new Error(
      'useMoexIndexListContext must be used within MoexIndexListProvider'
    );
  }
  return context;
}
