'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUrlStateSync } from '@/lib/url-state/use-url-state-sync';

const PORTFOLIO_ACCOUNT_KEY = 'cn_acc';

type PortfolioAccountUrlState = {
  accountID?: string;
};

type PortfolioAccountContextValue = {
  accountID: string;
  setAccountID: Dispatch<SetStateAction<string>>;
};

const PortfolioAccountContext = createContext<PortfolioAccountContextValue | null>(null);

const parsePortfolioUrlState = (searchParams: URLSearchParams): PortfolioAccountUrlState => {
  const accountID = searchParams.get(PORTFOLIO_ACCOUNT_KEY)?.trim();
  return {
    accountID: accountID && accountID.length > 0 ? accountID : undefined,
  };
};

export function PortfolioAccountProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();

  const parsedUrl = useMemo(
    () => parsePortfolioUrlState(new URLSearchParams(urlKey)),
    [urlKey],
  );

  const [accountID, setAccountID] = useState(() => parsedUrl.accountID ?? '');

  const urlStateKey = useMemo(
    () => JSON.stringify({ accountID }),
    [accountID],
  );

  useUrlStateSync({
    pathname,
    urlKey,
    stateKey: urlStateKey,
    parse: parsePortfolioUrlState,
    applyParsedState: next => {
      setAccountID(next.accountID ?? '');
    },
    buildSearchParams: () => {
      const next = new URLSearchParams(window.location.search);
      next.delete(PORTFOLIO_ACCOUNT_KEY);

      const accountValue = accountID.trim();
      if (accountValue.length > 0) {
        next.set(PORTFOLIO_ACCOUNT_KEY, accountValue);
      }

      return next;
    },
  });

  const value = useMemo(
    () => ({ accountID, setAccountID }),
    [accountID],
  );

  return (
    <PortfolioAccountContext.Provider value={value}>
      {children}
    </PortfolioAccountContext.Provider>
  );
}

export function usePortfolioAccountContext(): PortfolioAccountContextValue {
  const context = useContext(PortfolioAccountContext);
  if (!context) {
    throw new Error(
      'usePortfolioAccountContext must be used within PortfolioAccountProvider',
    );
  }
  return context;
}
