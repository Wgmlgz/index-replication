'use client';

import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { PortfolioOperationsTable } from '@/app/portfolio/components/portfolio-operations-table';

export default function PortfolioOverviewOperationsPage() {
  const { selectedPortfolioID } = usePortfolioDetailsContext();

  return <PortfolioOperationsTable portfolioID={selectedPortfolioID} />;
}
