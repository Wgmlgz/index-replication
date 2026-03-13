'use client';

import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { PortfolioSummaryPanel } from '@/app/portfolio/components/portfolio-summary-panel';

export default function PortfolioOverviewSummaryPage() {
  const { selectedPortfolioID } = usePortfolioDetailsContext();

  return <PortfolioSummaryPanel portfolioID={selectedPortfolioID} />;
}
