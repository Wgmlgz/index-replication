import type {
  ProviderCompositionSeriesMap,
  ProviderCompositionSnapshotPoint,
  ProviderPriceHistoryPoint,
} from '@/components/charts-new/data/domain/models';
import type {
  CompositionSeriesQuery,
  CompositionSnapshotQuery,
  PriceHistoryQuery,
} from '@/components/charts-new/data/domain/queries';

export type ChartsDataProvider = {
  id: string;
  getPriceHistory: (query: PriceHistoryQuery) => Promise<ProviderPriceHistoryPoint[]>;
  getCompositionSnapshot: (
    query: CompositionSnapshotQuery
  ) => Promise<ProviderCompositionSnapshotPoint[]>;
  getCompositionSeries: (
    query: CompositionSeriesQuery
  ) => Promise<ProviderCompositionSeriesMap>;
};

