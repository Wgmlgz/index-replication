'use client';

import { PortfolioAnalyticsSection } from '@/app/portfolio/portfolio-analytics-section';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';

export default function PortfolioAnalyticsPage() {
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();

  return (
    <PortfolioAnalyticsSection
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
