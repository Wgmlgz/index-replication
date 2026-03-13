'use client';

import { createContext, type ReactNode, useContext } from 'react';

import type { NormalizedPortfolioProfile } from '@/app/portfolio/use-portfolio';

type PortfolioDetailsContextValue = {
  selectedPortfolioID: number | null;
  selectedProfile: NormalizedPortfolioProfile | null;
  refreshProfiles: () => Promise<void>;
};

const PortfolioDetailsContext = createContext<PortfolioDetailsContextValue | null>(null);

type PortfolioDetailsProviderProps = {
  value: PortfolioDetailsContextValue;
  children: ReactNode;
};

export function PortfolioDetailsProvider({
  value,
  children,
}: PortfolioDetailsProviderProps) {
  return (
    <PortfolioDetailsContext.Provider value={value}>
      {children}
    </PortfolioDetailsContext.Provider>
  );
}

export function usePortfolioDetailsContext(): PortfolioDetailsContextValue {
  const context = useContext(PortfolioDetailsContext);
  if (!context) {
    throw new Error('usePortfolioDetailsContext must be used within PortfolioDetailsProvider');
  }
  return context;
}
