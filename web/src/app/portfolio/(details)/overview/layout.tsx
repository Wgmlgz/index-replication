'use client';

import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, ClipboardList, LineChart, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PORTFOLIO_V2_ROUTES } from '@/lib/portfolio';

type OverviewTab = 'summary' | 'operations' | 'compare' | 'analytics';

type PortfolioOverviewLayoutProps = {
  children: ReactNode;
};

function resolveOverviewTab(pathname: string): OverviewTab {
  if (pathname === PORTFOLIO_V2_ROUTES.overviewOperations) {
    return 'operations';
  }
  if (pathname === PORTFOLIO_V2_ROUTES.overviewCompare) {
    return 'compare';
  }
  if (pathname === PORTFOLIO_V2_ROUTES.overviewAnalytics) {
    return 'analytics';
  }
  return 'summary';
}

const OVERVIEW_TAB_ROUTES: Record<OverviewTab, string> = {
  summary: PORTFOLIO_V2_ROUTES.overview,
  operations: PORTFOLIO_V2_ROUTES.overviewOperations,
  compare: PORTFOLIO_V2_ROUTES.overviewCompare,
  analytics: PORTFOLIO_V2_ROUTES.overviewAnalytics,
};

export default function PortfolioOverviewLayout({
  children,
}: PortfolioOverviewLayoutProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = useMemo(
    () => resolveOverviewTab(pathname),
    [pathname],
  );

  const handleTabChange = useCallback(
    (nextTabRaw: string) => {
      const nextTab: OverviewTab =
        nextTabRaw === 'operations'
          ? 'operations'
          : nextTabRaw === 'compare'
            ? 'compare'
            : nextTabRaw === 'analytics'
              ? 'analytics'
              : 'summary';
      const nextPath = OVERVIEW_TAB_ROUTES[nextTab];
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('overview_tab');
      nextParams.delete('tab');

      const query = nextParams.toString();
      const href = query ? `${nextPath}?${query}` : nextPath;
      router.replace(href, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const legacyOverviewTab = searchParams.get('overview_tab');
    if (!legacyOverviewTab) {
      return;
    }

    const nextTab: OverviewTab =
      legacyOverviewTab === 'operations'
        ? 'operations'
        : legacyOverviewTab === 'compare'
          ? 'compare'
          : 'summary';
    const nextPath = OVERVIEW_TAB_ROUTES[nextTab];
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('overview_tab');
    nextParams.delete('tab');

    const query = nextParams.toString();
    const href = query ? `${nextPath}?${query}` : nextPath;
    const currentQuery = searchParams.toString();
    const currentHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    if (href !== currentHref) {
      router.replace(href, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className='h-full w-full'
    >
      <TabsList className='grid h-auto w-full grid-cols-2 md:w-auto md:grid-cols-4'>
        <TabsTrigger value='summary'>
          <Wallet className='size-4' />
          {t('portfolio.overview.tabs.summary')}
        </TabsTrigger>
        <TabsTrigger value='operations'>
          <ClipboardList className='size-4' />
          {t('portfolio.overview.tabs.operations')}
        </TabsTrigger>
        <TabsTrigger value='compare'>
          <BarChart3 className='size-4' />
          {t('portfolio.overview.tabs.compare')}
        </TabsTrigger>
        <TabsTrigger value='analytics'>
          <LineChart className='size-4' />
          {t('portfolio.overview.tabs.analytics')}
        </TabsTrigger>
      </TabsList>

      <div className='h-full'>
        {children}
      </div>
    </Tabs>
  );
}
