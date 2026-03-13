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

export type ChartsDataProviderCache = {
  staleTime: number;
  gcTime?: number;
  refetchOnMount?: boolean | 'always';
  persist?: boolean;
};

export type ChartsDataProvider = {
  id: string;
  cache: ChartsDataProviderCache;
  getPriceHistory: (query: PriceHistoryQuery) => Promise<ProviderPriceHistoryPoint[]>;
  getCompositionSnapshot: (
    query: CompositionSnapshotQuery
  ) => Promise<ProviderCompositionSnapshotPoint[]>;
  getCompositionSeries: (
    query: CompositionSeriesQuery
  ) => Promise<ProviderCompositionSeriesMap>;
};
