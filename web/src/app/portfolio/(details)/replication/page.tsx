'use client';

import { PortfolioReplicationPanel } from '@/app/portfolio/components/portfolio-replication-panel';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';

export default function PortfolioReplicationPage() {
  const { selectedPortfolioID, selectedProfile, refreshProfiles } = usePortfolioDetailsContext();

  return (
    <PortfolioReplicationPanel
      portfolioID={selectedPortfolioID}
      profile={selectedProfile}
      refreshProfiles={refreshProfiles}
    />
  );
}
