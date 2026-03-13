'use client';

import { useMemo } from 'react';
import type { MoexIndex } from '@/api-client';
import { useTranslation } from 'react-i18next';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import {
  createMoexChartsDataProvider,
  createPortfolioChartsDataProvider,
  useCompositionVisualizationData,
  type ChartsDataProvider,
} from '@/components/charts-new/data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CompositionCompareTable } from '@/app/portfolio/components/analytics/composition-compare-table';
import type {
  CompositionCompareRow,
  CompositionCompareSummary,
} from '@/app/portfolio/components/analytics/types';
import { resolveSnapshotKey } from '@/app/portfolio/components/analytics/utils';

const EMPTY_PROVIDER: ChartsDataProvider = {
  id: 'portfolio:none',
  cache: {
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    persist: false,
  },
  getPriceHistory: () => Promise.resolve([]),
  getCompositionSnapshot: () => Promise.resolve([]),
  getCompositionSeries: () => Promise.resolve({}),
};

export default function PortfolioOverviewComparePage() {
  const { t } = useTranslation();
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();
  const portfolioID = selectedPortfolioID;
  const portfolioName = selectedProfile?.name || '';
  const benchmarkSecid = selectedProfile?.replication?.is_enabled
    ? selectedProfile.replication.benchmark_secid
    : null;
  const compareControls = useMemo(
    () => ({
      compositionSelectionMode: 'fixed' as const,
      compositionSelectionDate: '',
      compositionTab: 'snapshot' as const,
      topCount: null,
    }),
    [],
  );

  const selectedPortfolio = useMemo<MoexIndex | null>(() => {
    if (!portfolioID) return null;
    const secid = String(portfolioID);
    return {
      secid,
      name: portfolioName || secid,
      shortName: portfolioName || secid,
      currency: '',
      decimals: 2,
      hasComposition: true,
    };
  }, [portfolioID, portfolioName]);

  const selectedBenchmark = useMemo<MoexIndex | null>(() => {
    const secid = benchmarkSecid?.trim();
    if (!secid) {
      return null;
    }

    return {
      secid,
      name: secid,
      shortName: secid,
      currency: '',
      decimals: 2,
      hasComposition: true,
    };
  }, [benchmarkSecid]);

  const hasBenchmark = Boolean(selectedBenchmark);

  const portfolioProvider = useMemo(
    () =>
      portfolioID
        ? createPortfolioChartsDataProvider(portfolioID)
        : EMPTY_PROVIDER,
    [portfolioID],
  );
  const moexProvider = useMemo(() => createMoexChartsDataProvider(), []);

  const portfolioCompositionState = useCompositionVisualizationData({
    selectedIndex: selectedPortfolio,
    latestTradeDate: null,
    baseRange: {
      rangeKey: '1y',
      intervalKey: 'auto',
      customFrom: '',
      customTill: '',
    },
    controls: compareControls,
    provider: portfolioProvider,
  });

  const indexCompositionState = useCompositionVisualizationData({
    selectedIndex: selectedBenchmark,
    latestTradeDate: null,
    baseRange: {
      rangeKey: '1y',
      intervalKey: 'auto',
      customFrom: '',
      customTill: '',
    },
    controls: compareControls,
    provider: moexProvider,
  });

  const compareRows = useMemo<CompositionCompareRow[]>(() => {
    if (!hasBenchmark) {
      return [];
    }

    const portfolioByKey = new Map(
      portfolioCompositionState.snapshotItems.map(item => [
        resolveSnapshotKey(item),
        item,
      ]),
    );
    const benchmarkByKey = new Map(
      indexCompositionState.snapshotItems.map(item => [
        resolveSnapshotKey(item),
        item,
      ]),
    );
    const keys = new Set<string>([
      ...portfolioByKey.keys(),
      ...benchmarkByKey.keys(),
    ]);

    const baseRows: Omit<CompositionCompareRow, 'contributionPct'>[] = [];
    let totalSquaredError = 0;
    for (const key of keys) {
      if (!key) continue;
      const portfolioItem = portfolioByKey.get(key);
      const benchmarkItem = benchmarkByKey.get(key);
      const portfolioWeight = portfolioItem?.weight ?? 0;
      const benchmarkWeight = benchmarkItem?.weight ?? 0;
      const activeWeight = portfolioWeight - benchmarkWeight;
      const absActive = Math.abs(activeWeight);
      totalSquaredError += activeWeight * activeWeight;

      const status: CompositionCompareRow['status'] =
        portfolioWeight > 0 && benchmarkWeight === 0
          ? 'portfolio_only'
          : benchmarkWeight > 0 && portfolioWeight === 0
            ? 'benchmark_only'
            : activeWeight > 0
              ? 'overweight'
              : activeWeight < 0
                ? 'underweight'
                : 'neutral';

      baseRows.push({
        key,
        ticker: portfolioItem?.ticker || benchmarkItem?.ticker || key,
        name: portfolioItem?.name || benchmarkItem?.name || key,
        portfolioWeight,
        benchmarkWeight,
        activeWeight,
        absActive,
        status,
      });
    }

    return baseRows
      .map(row => ({
        ...row,
        contributionPct:
          totalSquaredError > 0
            ? (row.activeWeight * row.activeWeight * 100) / totalSquaredError
            : 0,
      }))
      .sort((a, b) => b.absActive - a.absActive);
  }, [
    hasBenchmark,
    indexCompositionState.snapshotItems,
    portfolioCompositionState.snapshotItems,
  ]);

  const compareSummary = useMemo<CompositionCompareSummary>(() => {
    let squaredErrorSum = 0;
    let absActiveSum = 0;
    let overlapSum = 0;
    let overweightCount = 0;
    let underweightCount = 0;
    let portfolioOnlyCount = 0;
    let benchmarkOnlyCount = 0;

    for (const row of compareRows) {
      squaredErrorSum += row.activeWeight * row.activeWeight;
      absActiveSum += row.absActive;
      overlapSum += Math.min(row.portfolioWeight, row.benchmarkWeight);
      if (row.status === 'overweight') overweightCount += 1;
      if (row.status === 'underweight') underweightCount += 1;
      if (row.status === 'portfolio_only') portfolioOnlyCount += 1;
      if (row.status === 'benchmark_only') benchmarkOnlyCount += 1;
    }

    return {
      trackingError: Math.sqrt(squaredErrorSum),
      meanAbsActive: absActiveSum / 2,
      overlap: overlapSum,
      overweightCount,
      underweightCount,
      portfolioOnlyCount,
      benchmarkOnlyCount,
    };
  }, [compareRows]);

  const compareLoading =
    portfolioCompositionState.snapshotLoading
    || indexCompositionState.snapshotLoading;
  const compareError =
    portfolioCompositionState.snapshotError || indexCompositionState.snapshotError;
  const compareNoDataMessage = useMemo(() => {
    if (!hasBenchmark) {
      return t('portfolio.composition.noBenchmark');
    }
    return t('portfolio.composition.compare.noData');
  }, [hasBenchmark, t]);

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.composition.tabs.compare')}</CardTitle>
          <CardDescription>
            {t('portfolio.composition.compare.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.card.selectPrompt')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='h-full min-h-0 overflow-hidden'>
      <CardHeader>
        <CardTitle>{t('portfolio.composition.tabs.compare')}</CardTitle>
        <CardDescription>
          {t('portfolio.composition.compare.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'>
        <CompositionCompareTable
          loading={compareLoading}
          hasError={compareError}
          noDataMessage={compareNoDataMessage}
          rows={compareRows}
          summary={compareSummary}
        />
      </CardContent>
    </Card>
  );
}
