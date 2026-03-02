'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MoexIndex } from '@/api-client';
import type { ProviderCompositionSnapshotPoint } from '@/components/charts-new/data/domain/models';
import type { CompositionSnapshotItem } from '@/components/charts-new/visualization/chart-types';
import {
  resolveDateRange,
  resolveIntervalDays,
} from '@/lib/charting/time-series-controls';
import type { BaseRangeControls } from '@/components/charts-new/types/controls';
import type { CompositionSnapshotDataState } from './chart-query.types';
import { normalizeIsoDate } from './data-analytics';
import type { ChartsDataProvider } from './providers';

type CompositionSnapshotControls = BaseRangeControls & {
  compositionSelectionMode: 'fixed' | 'rolling';
  compositionSelectionDate: string;
};

export function useCompositionSnapshotData(options: {
  selectedIndex: MoexIndex | null;
  latestTradeDate: string | null;
  controls: CompositionSnapshotControls;
  provider: ChartsDataProvider;
}): CompositionSnapshotDataState {
  const { selectedIndex, latestTradeDate, controls, provider } = options;
  const dateRange = useMemo(
    () =>
      resolveDateRange(
        controls.rangeKey,
        controls.customFrom,
        controls.customTill
      ),
    [controls.customFrom, controls.customTill, controls.rangeKey]
  );

  const effectiveSelectionDate = useMemo(() => {
    return (
      normalizeIsoDate(controls.compositionSelectionDate) ??
      normalizeIsoDate(latestTradeDate) ??
      normalizeIsoDate(dateRange.till) ??
      undefined
    );
  }, [controls.compositionSelectionDate, dateRange.till, latestTradeDate]);

  const intervalDays = useMemo(
    () => resolveIntervalDays(controls.intervalKey),
    [controls.intervalKey]
  );

  const snapshotQuery = useQuery({
    queryKey: [
      provider.id,
      'moex-index-composition',
      selectedIndex?.secid,
      controls.compositionSelectionMode,
      effectiveSelectionDate ?? 'latest',
    ],
    queryFn: async () => {
      return provider.getCompositionSnapshot({
        secid: selectedIndex!.secid ?? '',
        selectionMode: controls.compositionSelectionMode,
        selectionDate: effectiveSelectionDate,
      });
    },
    enabled: Boolean(selectedIndex?.secid && selectedIndex?.hasComposition),
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const snapshotItems = useMemo<CompositionSnapshotItem[]>(() => {
    const rows: ProviderCompositionSnapshotPoint[] = snapshotQuery.data ?? [];
    return rows
      .map(row => ({
        ticker: row.ticker ?? '',
        secId: row.secId ?? '',
        name: row.name || row.ticker || '',
        weight: row.weight ?? 0,
        tradeDate: row.tradeDate ?? '',
      }))
      .filter(row => row.ticker.length > 0 && row.tradeDate.length > 0)
      .sort((a, b) => b.weight - a.weight);
  }, [snapshotQuery.data]);

  const snapshotDate = snapshotItems[0]?.tradeDate ?? effectiveSelectionDate ?? null;

  return {
    snapshotLoading: snapshotQuery.isLoading,
    snapshotError: Boolean(snapshotQuery.error),
    snapshotDate,
    snapshotItems,
    effectiveSelectionDate,
    dateRange,
    intervalDays,
  };
}
