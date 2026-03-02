import type { CompositionSelectionMode } from '@/lib/charting/chart-controls-url-state';

export type PriceHistoryQuery = {
  secid: string;
  from?: string;
  till?: string;
  intervalDays?: number;
};

export type CompositionSnapshotQuery = {
  secid: string;
  selectionMode?: CompositionSelectionMode;
  selectionDate?: string;
};

export type CompositionSeriesQuery = {
  secid: string;
  tickers?: string;
  topCount?: number;
  selectionMode: CompositionSelectionMode;
  selectionDate?: string;
  from?: string;
  till?: string;
  intervalDays?: number;
};
