'use client';

import { type ReactNode, useCallback, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Clock3, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PORTFOLIO_V2_ROUTES } from '@/lib/portfolio';

type ReplicationTab = 'settings' | 'drafts';

type PortfolioReplicationLayoutProps = {
  children: ReactNode;
};

const REPLICATION_TAB_ROUTES: Record<ReplicationTab, string> = {
  settings: PORTFOLIO_V2_ROUTES.replication,
  drafts: PORTFOLIO_V2_ROUTES.replicationDrafts,
};

function resolveReplicationTab(pathname: string): ReplicationTab {
  if (pathname === PORTFOLIO_V2_ROUTES.replicationDrafts) {
    return 'drafts';
  }
  return 'settings';
}

export default function PortfolioReplicationLayout({
  children,
}: PortfolioReplicationLayoutProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = useMemo(
    () => resolveReplicationTab(pathname),
    [pathname],
  );

  const handleTabChange = useCallback(
    (nextTabRaw: string) => {
      const nextTab: ReplicationTab = nextTabRaw === 'drafts' ? 'drafts' : 'settings';
      const nextPath = REPLICATION_TAB_ROUTES[nextTab];
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('replication_tab');
      nextParams.delete('tab');

      const query = nextParams.toString();
      const href = query ? `${nextPath}?${query}` : nextPath;
      router.replace(href, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const legacyReplicationTab = searchParams.get('replication_tab');
    if (!legacyReplicationTab) {
      return;
    }

    const nextTab: ReplicationTab = legacyReplicationTab === 'drafts' ? 'drafts' : 'settings';
    const nextPath = REPLICATION_TAB_ROUTES[nextTab];
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('replication_tab');
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
      className='min-h-0 min-w-0 flex-1 gap-4 overflow-hidden'
    >
      <TabsList className='grid h-auto w-full grid-cols-2 md:w-auto'>
        <TabsTrigger value='drafts' className='gap-1.5'>
          <Clock3 className='size-4' />
          {t('portfolio.replication.tabs.drafts')}
        </TabsTrigger>
        <TabsTrigger value='settings' className='gap-1.5'>
          <Settings className='size-4' />
          {t('portfolio.replication.tabs.settings')}
        </TabsTrigger>
      </TabsList>

      <div className='min-h-0 min-w-0 flex-1 overflow-hidden'>
        {children}
      </div>
    </Tabs>
  );
}
