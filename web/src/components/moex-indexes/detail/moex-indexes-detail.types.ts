import type { MoexIndex } from '@/lib/moex-client';
import type { ChartPoint } from './index-chart';

export type MoexIndexDetailState = {
  selectedIndex: MoexIndex | null;
  selectedIndexCollections: string[];
  historyLoading: boolean;
  chartData: ChartPoint[];
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
  error: string | null;
};
