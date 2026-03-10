import type {
  CompositionSeries,
  CompositionSnapshotItem,
  PriceChartData,
} from '@/components/charts-new/visualization/chart-types';

export type PriceVisualizationDataState = {
  loading: boolean;
  error: boolean;
  data: PriceChartData;
  dateRange: {
    from?: string;
    till?: string;
  };
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
  currency: string;
};

export type CompositionSnapshotDataState = {
  snapshotLoading: boolean;
  snapshotError: boolean;
  snapshotDate: string | null;
  snapshotItems: CompositionSnapshotItem[];
  effectiveSelectionDate?: string;
  dateRange: {
    from?: string;
    till?: string;
  };
  intervalDays?: number;
};

export type CompositionSeriesDataState = {
  seriesLoading: boolean;
  seriesError: boolean;
  series: CompositionSeries[];
};

export type CompositionVisualizationDataState = {
  snapshotLoading: boolean;
  snapshotError: boolean;
  snapshotDate: string | null;
  snapshotItems: CompositionSnapshotItem[];
  dateRange: {
    from?: string;
    till?: string;
  };
  seriesLoading: boolean;
  seriesError: boolean;
  series: CompositionSeries[];
};
