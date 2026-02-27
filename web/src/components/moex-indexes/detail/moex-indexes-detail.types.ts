import type { MoexIndex as MoexIndex } from '@/api-client';
import type { ChartData, ChartSeriesType } from '@/components/charts/index-chart';
import type {
  ChartViewMode,
  IntervalKey,
  RangeKey,
} from '@/lib/charting/time-series-controls';
export type { ChartViewMode, IntervalKey, RangeKey };

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
