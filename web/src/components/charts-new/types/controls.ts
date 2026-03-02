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

export type BaseRangeControls = {
  rangeKey: RangeKey;
  intervalKey: IntervalKey;
  customFrom: string;
  customTill: string;
};

export type PriceDataControls = BaseRangeControls & {
  viewMode: ChartViewMode;
  chartType: ChartType;
};

export type CompositionDataControls = BaseRangeControls & {
  compositionSelectionMode: CompositionSelectionMode;
  compositionSelectionDate: string;
  compositionTab: CompositionTab;
  topCount: number | null;
};

