'use client';

import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import {
  buildPortfolioActionTabs,
  resolvePortfolioActionTabValue,
} from '@/app/portfolio/components/actions-tabs';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PORTFOLIO_V2_ROUTES } from '@/lib/portfolio';

type PortfolioActionsLayoutProps = {
  children: ReactNode;
};

export default function PortfolioActionsLayout({
  children,
}: PortfolioActionsLayoutProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedProfile } = usePortfolioDetailsContext();

  const actionTabs = useMemo(
    () =>
      buildPortfolioActionTabs(
        selectedProfile?.capabilities?.actions ?? [],
        t('portfolio.card.runAction'),
      ),
    [selectedProfile?.capabilities?.actions, t],
  );
  const requestedActionTab = searchParams.get('action_tab')?.trim() ?? '';
  const activeTab = useMemo(
    () => resolvePortfolioActionTabValue(actionTabs, requestedActionTab),
    [actionTabs, requestedActionTab],
  );

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (!nextTab) {
        return;
      }

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('action_tab', nextTab);
      nextParams.delete('tab');

      const query = nextParams.toString();
      const href = query ? `${PORTFOLIO_V2_ROUTES.actions}?${query}` : PORTFOLIO_V2_ROUTES.actions;
      router.replace(href, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (actionTabs.length === 0) {
      if (!nextParams.has('action_tab')) {
        return;
      }
      nextParams.delete('action_tab');
    } else {
      const currentActionTab = nextParams.get('action_tab');
      if (currentActionTab === activeTab) {
        return;
      }
      nextParams.set('action_tab', activeTab);
    }

    const query = nextParams.toString();
    const href = query ? `${PORTFOLIO_V2_ROUTES.actions}?${query}` : PORTFOLIO_V2_ROUTES.actions;
    const currentQuery = searchParams.toString();
    const currentHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (href !== currentHref) {
      router.replace(href, { scroll: false });
    }
  }, [activeTab, actionTabs.length, pathname, router, searchParams]);

  if (actionTabs.length === 0) {
    return <div className='min-h-0 min-w-0 flex-1 overflow-hidden'>{children}</div>;
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className='min-h-0 min-w-0 flex-1 gap-4 overflow-hidden'
    >
      <TabsList className='grid h-auto w-full grid-cols-2 md:w-auto md:grid-cols-4'>
        {actionTabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className='min-h-0 min-w-0 flex-1 overflow-hidden'>{children}</div>
    </Tabs>
  );
}
