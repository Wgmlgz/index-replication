'use client';

import { PortfolioCompositionComparePanel } from '@/app/portfolio/components/portfolio-composition-compare-panel';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';

export default function PortfolioOverviewComparePage() {
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();

  return (
    <PortfolioCompositionComparePanel
      portfolioID={selectedPortfolioID}
      portfolioName={selectedProfile?.name || ''}
      benchmarkSecid={
        selectedProfile?.replication?.is_enabled
          ? selectedProfile.replication.benchmark_secid
          : null
      }
    />
  );
}
