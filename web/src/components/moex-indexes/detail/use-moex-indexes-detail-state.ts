'use client';

import { useMemo, useState } from 'react';
import { format, subYears } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { ModelsMoexIndex as MoexIndex } from '@/api-client';
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

  const [rangeKey, setRangeKey] = useState<RangeKey>(
    () => initial?.rangeKey ?? '1y'
  );
  const [intervalKey, setIntervalKey] = useState<IntervalKey>(
    () => initial?.intervalKey ?? 'auto'
  );
  const [customFrom, setCustomFrom] = useState(
    () => initial?.customFrom ?? defaultFrom
  );
  const [customTill, setCustomTill] = useState(
    () => initial?.customTill ?? defaultTill
  );
  const [viewMode, setViewMode] = useState<ChartViewMode>(
    () => initial?.viewMode ?? 'price'
  );
  const [chartType, setChartType] = useState<ChartType>(
    () => initial?.chartType ?? 'line'
  );
  const [compositionTab, setCompositionTab] = useState<CompositionTab>(
    () => initial?.compositionTab ?? 'snapshot'
  );
  const [compositionSelectionMode, setCompositionSelectionMode] =
    useState<CompositionSelectionMode>(
      () => initial?.compositionSelectionMode ?? 'fixed'
    );
  const [compositionSelectionDate, setCompositionSelectionDate] = useState(
    () => initial?.compositionSelectionDate ?? ''
  );
  const [compositionTopCount, setCompositionTopCount] = useState<number | null>(
    () => initial?.compositionTopCount ?? 10
  );

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
    rangeKey,
    intervalKey,
    customFrom,
    customTill,
    viewMode,
    chartType,
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
    rangeKey,
    setRangeKey,
    intervalKey,
    setIntervalKey,
    customFrom,
    customTill,
    setCustomFrom,
    setCustomTill,
    viewMode,
    setViewMode,
    chartType,
    setChartType,
    compositionTab,
    setCompositionTab,
    compositionSelectionMode,
    setCompositionSelectionMode,
    compositionSelectionDate,
    setCompositionSelectionDate,
    compositionTopCount,
    setCompositionTopCount,
  };
}
