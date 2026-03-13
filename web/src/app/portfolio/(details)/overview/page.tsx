'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, ClipboardList, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PortfolioCompositionComparePanel } from '@/app/portfolio/components/portfolio-composition-compare-panel';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { PortfolioOperationsTable } from '@/app/portfolio/components/portfolio-operations-table';
import { PortfolioSummaryPanel } from '@/app/portfolio/components/portfolio-summary-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type OverviewTab = 'summary' | 'operations' | 'compare';

function resolveOverviewTab(tab: string | null): OverviewTab {
  if (tab === 'operations' || tab === 'compare') {
    return tab;
  }

  return 'summary';
}

export default function PortfolioOverviewPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();

  const activeOverviewTab = useMemo(
    () => resolveOverviewTab(searchParams.get('overview_tab')),
    [searchParams],
  );

  const handleOverviewTabChange = useCallback(
    (nextTab: string) => {
      const resolvedTab = resolveOverviewTab(nextTab);
      const nextParams = new URLSearchParams(searchParams.toString());

      if (resolvedTab === 'summary') {
        nextParams.delete('overview_tab');
      } else {
        nextParams.set('overview_tab', resolvedTab);
      }

      const query = nextParams.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <Tabs
      value={activeOverviewTab}
      onValueChange={handleOverviewTabChange}
      className='min-h-0 min-w-0 flex-1 gap-4 overflow-hidden'
    >
      <TabsList className='grid h-auto w-full grid-cols-3 md:w-auto'>
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
      </TabsList>

      <TabsContent value='summary' className='min-h-0 min-w-0 flex-1 overflow-hidden'>
        <PortfolioSummaryPanel portfolioID={selectedPortfolioID} />
      </TabsContent>

      <TabsContent
        value='operations'
        className='min-h-0 min-w-0 flex-1 overflow-hidden data-[state=active]:flex'
      >
        <PortfolioOperationsTable portfolioID={selectedPortfolioID} />
      </TabsContent>

      <TabsContent value='compare' className='min-h-0 min-w-0 flex-1 overflow-hidden'>
        <PortfolioCompositionComparePanel
          portfolioID={selectedPortfolioID}
          portfolioName={selectedProfile?.name || ''}
          benchmarkSecid={
            selectedProfile?.replication?.is_enabled
              ? selectedProfile.replication.benchmark_secid
              : null
          }
        />
      </TabsContent>
    </Tabs>
  );
}
