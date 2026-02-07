'use client';

import { useMemo, useState } from 'react';
import { format, subYears } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { MoexIndex } from '@/lib/moex-client';
import type {
  ChartType,
  ChartViewMode,
  CompositionTab,
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
    customFrom: string;
    customTill: string;
    viewMode: ChartViewMode;
    chartType: ChartType;
    compositionTab: CompositionTab;
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

  const selectedIndex = useMemo<MoexIndex | null>(() => {
    const findIndex = (secid: string) => {
      const key = secid.toUpperCase();
      return (
        favoritesBySecid.find((item) => item.secid.toUpperCase() === key) ??
        indexes.find((item) => item.secid.toUpperCase() === key) ??
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

    return findIndex('IMOEX') ?? favoritesBySecid[0] ?? indexes[0] ?? null;
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
    customFrom,
    customTill,
    viewMode,
    chartType,
  });

  const selectedIndexCollections = useMemo(() => {
    if (!selectedIndex) return [];
    return indexCollectionsMap[selectedIndex.secid.toUpperCase()] ?? [];
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
  };
}
