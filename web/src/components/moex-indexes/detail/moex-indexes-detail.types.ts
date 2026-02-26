import type { MoexIndex as MoexIndex } from '@/api-client';
import type { ChartData, ChartSeriesType } from './index-chart';

export type RangeKey =
  | '1m'
  | '3m'
  | '6m'
  | 'ytd'
  | '1y'
  | '3y'
  | '5y'
  | 'max'
  | 'custom';

export type IntervalKey = 'auto' | '1d' | '2d' | '3d' | '1w' | '2w' | '1m';

export type ChartViewMode = 'price' | 'percent';
export type ChartType = ChartSeriesType;
export type CompositionTab = 'snapshot' | 'trend' | 'stacked';
export type CompositionSelectionMode = 'fixed' | 'rolling';

export type MoexIndexDetailState = {
  selectedIndex: MoexIndex | null;
  selectedIndexCollections: string[];
  historyLoading: boolean;
  chartData: ChartData;
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
  error: string | null;
  rangeKey: RangeKey;
  setRangeKey: (next: RangeKey) => void;
  intervalKey: IntervalKey;
  setIntervalKey: (next: IntervalKey) => void;
  customFrom: string;
  customTill: string;
  setCustomFrom: (next: string) => void;
  setCustomTill: (next: string) => void;
  viewMode: ChartViewMode;
  setViewMode: (next: ChartViewMode) => void;
  chartType: ChartType;
  setChartType: (next: ChartType) => void;
  compositionTab: CompositionTab;
  setCompositionTab: (next: CompositionTab) => void;
  compositionSelectionMode: CompositionSelectionMode;
  setCompositionSelectionMode: (next: CompositionSelectionMode) => void;
  compositionSelectionDate: string;
  setCompositionSelectionDate: (next: string) => void;
  compositionTopCount: number | null;
  setCompositionTopCount: (next: number | null) => void;
};
