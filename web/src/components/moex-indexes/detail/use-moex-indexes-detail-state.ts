'use client';

import { useMemo } from 'react';
import { format, subYears } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { MoexIndex as MoexIndex } from '@/api-client';
import { useChartControlsState } from '@/components/charts/use-chart-controls-state';
import type {
  ChartType,
  ChartViewMode,
  CompositionTab,
  CompositionSelectionMode,
  IntervalKey,
  MoexIndexDetailState,
  RangeKey,
} from './moex-indexes-detail.types';
import { useMoexIndexHistory } from './use-moex-indexes-history';

type DetailStateInput = {
  indexes: MoexIndex[];
  favorites: string[];
  favoritesBySecid: MoexIndex[];
  selectedSecid: string | null;
  indexCollectionsMap: Record<string, string[]>;
  initial?: Partial<{
    rangeKey: RangeKey;
    intervalKey: IntervalKey;
    customFrom: string;
    customTill: string;
    viewMode: ChartViewMode;
    chartType: ChartType;
    compositionTab: CompositionTab;
    compositionSelectionMode: CompositionSelectionMode;
    compositionSelectionDate: string;
    compositionTopCount: number | null;
  }>;
};

export function useMoexIndexDetailState({
  indexes,
  favorites,
  favoritesBySecid,
  selectedSecid,
  indexCollectionsMap,
  initial,
}: DetailStateInput): MoexIndexDetailState {
  const { t } = useTranslation();
  const today = new Date();
  const defaultFrom = format(subYears(today, 1), 'yyyy-MM-dd');
  const defaultTill = format(today, 'yyyy-MM-dd');
  const chartControls = useChartControlsState({
    initial,
    includeChartType: true,
    defaults: {
      rangeKey: '1y',
      intervalKey: 'auto',
      customFrom: defaultFrom,
      customTill: defaultTill,
      viewMode: 'price',
      chartType: 'line',
      compositionTab: 'snapshot',
      compositionSelectionMode: 'fixed',
      compositionSelectionDate: '',
      compositionTopCount: 10,
    },
  });

  const selectedIndex = useMemo<MoexIndex | null>(() => {
    const findIndex = (secid: string) => {
      const key = secid.toUpperCase();
      return (
        favoritesBySecid.find((item) => (item.secid ?? '').toUpperCase() === key) ??
        indexes.find((item) => (item.secid ?? '').toUpperCase() === key) ??
        null
      );
    };

    if (selectedSecid) {
      return findIndex(selectedSecid);
    }

    const favoriteMatch = favorites.find((secid) => Boolean(findIndex(secid)));
    if (favoriteMatch) {
      return findIndex(favoriteMatch);
    }

    const fallbackFavorite = favoritesBySecid.find((item) => Boolean(item.secid));
    const fallbackIndex = indexes.find((item) => Boolean(item.secid));
    return findIndex('IMOEX') ?? fallbackFavorite ?? fallbackIndex ?? null;
  }, [favorites, favoritesBySecid, indexes, selectedSecid]);

  const {
    historyLoading,
    historyError,
    chartData,
    latestValue,
    change,
    changePercent,
    numberFormatter,
  } = useMoexIndexHistory(selectedIndex, {
    rangeKey: chartControls.rangeKey,
    intervalKey: chartControls.intervalKey,
    customFrom: chartControls.customFrom,
    customTill: chartControls.customTill,
    viewMode: chartControls.viewMode,
    chartType: chartControls.chartType as ChartType,
  });

  const selectedIndexCollections = useMemo(() => {
    const selectedSecid = selectedIndex?.secid?.toUpperCase();
    if (!selectedSecid) return [];
    return indexCollectionsMap[selectedSecid] ?? [];
  }, [indexCollectionsMap, selectedIndex?.secid]);

  const error = historyError ? t('moex.errors.history') : null;

  return {
    selectedIndex,
    selectedIndexCollections,
    historyLoading,
    chartData,
    latestValue,
    change,
    changePercent,
    numberFormatter,
    error,
    rangeKey: chartControls.rangeKey,
    setRangeKey: chartControls.setRangeKey,
    intervalKey: chartControls.intervalKey,
    setIntervalKey: chartControls.setIntervalKey,
    customFrom: chartControls.customFrom,
    customTill: chartControls.customTill,
    setCustomFrom: chartControls.setCustomFrom,
    setCustomTill: chartControls.setCustomTill,
    viewMode: chartControls.viewMode,
    setViewMode: chartControls.setViewMode,
    chartType: chartControls.chartType,
    setChartType: chartControls.setChartType,
    compositionTab: chartControls.compositionTab,
    setCompositionTab: chartControls.setCompositionTab,
    compositionSelectionMode: chartControls.compositionSelectionMode,
    setCompositionSelectionMode: chartControls.setCompositionSelectionMode,
    compositionSelectionDate: chartControls.compositionSelectionDate,
    setCompositionSelectionDate: chartControls.setCompositionSelectionDate,
    compositionTopCount: chartControls.compositionTopCount,
    setCompositionTopCount: chartControls.setCompositionTopCount,
  };
}
