'use client';

import { PortfolioActionsPanel } from '@/app/portfolio/components/portfolio-actions-panel';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';

export default function PortfolioActionsPage() {
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();

  return (
    <PortfolioActionsPanel
      portfolioID={selectedPortfolioID}
      profile={selectedProfile}
    />
  );
}
