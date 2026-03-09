export type PortfolioPriceMode = 'portfolio' | 'index' | 'compare';
export type CompositionSourceMode = 'portfolio' | 'index';
export type CompositionDisplayTab = 'snapshot' | 'trend' | 'stacked' | 'compare';

export type CompositionCompareRow = {
  key: string;
  ticker: string;
  name: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  activeWeight: number;
  absActive: number;
  contributionPct: number;
  status:
    | 'overweight'
    | 'underweight'
    | 'neutral'
    | 'portfolio_only'
    | 'benchmark_only';
};

export type CompositionCompareSummary = {
  trackingError: number;
  meanAbsActive: number;
  overlap: number;
  overweightCount: number;
  underweightCount: number;
  portfolioOnlyCount: number;
  benchmarkOnlyCount: number;
};
