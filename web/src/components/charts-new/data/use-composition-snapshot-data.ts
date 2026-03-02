'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  MoexIndex,
  MoexIndexCompositionEntry,
} from '@/api-client';
import type { CompositionSnapshotItem } from '@/components/charts-new/visualization/chart-types';
import { moexApi } from '@/lib/api';
import {
  resolveDateRange,
  resolveIntervalDays,
} from '@/lib/charting/time-series-controls';
import type { BaseRangeControls } from '@/components/charts-new/types/controls';
import type { CompositionSnapshotDataState } from './chart-query.types';
import { normalizeIsoDate } from './data-analytics';

type CompositionSnapshotControls = BaseRangeControls & {
  compositionSelectionMode: 'fixed' | 'rolling';
  compositionSelectionDate: string;
};

export function useCompositionSnapshotData(options: {
  selectedIndex: MoexIndex | null;
  latestTradeDate: string | null;
  controls: CompositionSnapshotControls;
}): CompositionSnapshotDataState {
  const { selectedIndex, latestTradeDate, controls } = options;
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
      'moex-index-composition',
      selectedIndex?.secid,
      effectiveSelectionDate ?? 'latest',
    ],
    queryFn: async () => {
      const response = await moexApi.moexIndexesSecidCompositionGet(
        selectedIndex!.secid ?? '',
        effectiveSelectionDate
      );
      return response.data;
    },
    enabled: Boolean(selectedIndex?.secid && selectedIndex?.hasComposition),
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const snapshotItems = useMemo<CompositionSnapshotItem[]>(() => {
    const rows = snapshotQuery.data ?? [];
    return rows
      .map((row: MoexIndexCompositionEntry) => ({
        ticker: row.ticker ?? '',
        secId: row.secId ?? '',
        name: row.shortName || row.ticker || '',
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
