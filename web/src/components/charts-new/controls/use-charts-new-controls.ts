'use client';

import { format, subYears } from 'date-fns';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import type {
  CompositionSelectionMode,
  CompositionTab,
} from '@/lib/charting/chart-controls-url-state';
import type {
  ChartType,
  ChartViewMode,
  IntervalKey,
  RangeKey,
} from '@/lib/charting/time-series-controls';
import { useUrlStateSync } from '@/lib/url-state/use-url-state-sync';
import type {
  CompositionDataControls,
  PriceDataControls,
} from '@/components/charts-new/types/controls';
import {
  applyChartsNewControlsUrlState,
  parseChartsNewControlsUrlState,
  type ChartsNewControlsDefaults,
} from './controls-url-state';

type UseChartsNewControlsOptions = {
  defaults?: Partial<{
    price: Partial<PriceDataControls>;
    composition: Partial<CompositionDataControls>;
  }>;
};

export type PriceControlActions = {
  setRangeKey: (next: RangeKey) => void;
  setIntervalKey: (next: IntervalKey) => void;
  setCustomFrom: (next: string) => void;
  setCustomTill: (next: string) => void;
  setViewMode: (next: ChartViewMode) => void;
  setChartType: (next: ChartType) => void;
};

export type CompositionControlActions = {
  setSelectionMode: (next: CompositionSelectionMode) => void;
  setSelectionDate: (next: string) => void;
  setCompositionTab: (next: CompositionTab) => void;
  setTopCount: (next: number | null) => void;
};

const shallowEqual = <T extends Record<string, unknown>>(a: T, b: T) => {
  const aKeys = Object.keys(a) as (keyof T)[];
  const bKeys = Object.keys(b) as (keyof T)[];
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => Object.is(a[key], b[key]));
};

function buildDefaultControls(
  overrides?: UseChartsNewControlsOptions['defaults']
): ChartsNewControlsDefaults {
  const today = new Date();
  const defaultFrom = format(subYears(today, 1), 'yyyy-MM-dd');
  const defaultTill = format(today, 'yyyy-MM-dd');

  return {
    price: {
      rangeKey: '1y',
      intervalKey: 'auto',
      customFrom: defaultFrom,
      customTill: defaultTill,
      viewMode: 'price',
      chartType: 'line',
      ...overrides?.price,
    },
    composition: {
      compositionSelectionMode: 'fixed',
      compositionSelectionDate: '',
      compositionTab: 'snapshot',
      topCount: 10,
      ...overrides?.composition,
    },
  };
}

export function useChartsNewControls(options?: UseChartsNewControlsOptions) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();

  const defaults = useMemo(
    () => buildDefaultControls(options?.defaults),
    [options?.defaults]
  );

  const parsedUrlState = useMemo(
    () =>
      parseChartsNewControlsUrlState(new URLSearchParams(urlKey), defaults),
    [defaults, urlKey]
  );

  const [price, setPrice] = useState<PriceDataControls>(() => parsedUrlState.price);
  const [composition, setComposition] = useState<CompositionDataControls>(
    () => parsedUrlState.composition
  );

  const setPriceField = useCallback(
    <K extends keyof PriceDataControls>(key: K, value: PriceDataControls[K]) => {
      setPrice(prev =>
        Object.is(prev[key], value) ? prev : { ...prev, [key]: value }
      );
    },
    []
  );

  const setCompositionField = useCallback(
    <K extends keyof CompositionDataControls>(
      key: K,
      value: CompositionDataControls[K]
    ) => {
      setComposition(prev =>
        Object.is(prev[key], value) ? prev : { ...prev, [key]: value }
      );
    },
    []
  );

  const priceActions = useMemo<PriceControlActions>(
    () => ({
      setRangeKey: next => setPriceField('rangeKey', next),
      setIntervalKey: next => setPriceField('intervalKey', next),
      setCustomFrom: next => setPriceField('customFrom', next),
      setCustomTill: next => setPriceField('customTill', next),
      setViewMode: next => setPriceField('viewMode', next),
      setChartType: next => setPriceField('chartType', next),
    }),
    [setPriceField]
  );

  const compositionActions = useMemo<CompositionControlActions>(
    () => ({
      setSelectionMode: next => setCompositionField('compositionSelectionMode', next),
      setSelectionDate: next => setCompositionField('compositionSelectionDate', next),
      setCompositionTab: next => setCompositionField('compositionTab', next),
      setTopCount: next => setCompositionField('topCount', next),
    }),
    [setCompositionField]
  );

  const stateKey = useMemo(
    () =>
      JSON.stringify({
        price,
        composition,
      }),
    [composition, price]
  );

  useUrlStateSync({
    pathname,
    urlKey,
    stateKey,
    parse: params => parseChartsNewControlsUrlState(params, defaults),
    applyParsedState: parsed => {
      setPrice(prev => (shallowEqual(prev, parsed.price) ? prev : parsed.price));
      setComposition(prev =>
        shallowEqual(prev, parsed.composition) ? prev : parsed.composition
      );
    },
    buildSearchParams: () => {
      const next = new URLSearchParams(window.location.search);
      applyChartsNewControlsUrlState(
        next,
        {
          price,
          composition,
        },
        defaults
      );
      return next;
    },
  });

  return {
    defaults,
    price,
    composition,
    priceActions,
    compositionActions,
    setPriceField,
    setCompositionField,
  };
}
