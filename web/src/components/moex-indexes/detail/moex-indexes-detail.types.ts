import type { MoexIndex } from '@/lib/moex-client';
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

export type ChartViewMode = 'price' | 'percent';
export type ChartType = ChartSeriesType;

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
  customFrom: string;
  customTill: string;
  setCustomFrom: (next: string) => void;
  setCustomTill: (next: string) => void;
  viewMode: ChartViewMode;
  setViewMode: (next: ChartViewMode) => void;
  chartType: ChartType;
  setChartType: (next: ChartType) => void;
};
