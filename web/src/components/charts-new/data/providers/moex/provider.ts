import type {
  MoexIndexCompositionEntry,
  MoexIndexHistoryPoint,
  MoexIndexTickerAnalyticsPoint,
} from '@/api-client';
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
import { moexApi } from '@/lib/api';
import type { ChartsDataProvider } from '../types';

const MOEX_PROVIDER_ID = 'moex';

export function createMoexChartsDataProvider(): ChartsDataProvider {
  return {
    id: MOEX_PROVIDER_ID,
    getPriceHistory: async (
      query: PriceHistoryQuery
    ): Promise<ProviderPriceHistoryPoint[]> => {
      const response = await moexApi.moexIndexesSecidHistoryGet(
        query.secid,
        query.from,
        query.till,
        query.intervalDays
      );
      const rows = response.data ?? [];
      return rows.map((row: MoexIndexHistoryPoint) => ({
        tradeDate: row.tradeDate,
        close: row.close,
        open: row.open ?? null,
        high: row.high ?? null,
        low: row.low ?? null,
      }));
    },
    getCompositionSnapshot: async (
      query: CompositionSnapshotQuery
    ): Promise<ProviderCompositionSnapshotPoint[]> => {
      const response = await moexApi.moexIndexesSecidCompositionGet(
        query.secid,
        query.selectionDate
      );
      const rows = response.data ?? [];
      return rows.map((row: MoexIndexCompositionEntry) => ({
        ticker: row.ticker,
        secId: row.secId,
        name: row.shortName || row.ticker,
        weight: row.weight,
        tradeDate: row.tradeDate,
      }));
    },
    getCompositionSeries: async (
      query: CompositionSeriesQuery
    ): Promise<ProviderCompositionSeriesMap> => {
      const response = await moexApi.moexIndexesSecidCompositionSeriesGet(
        query.secid,
        query.tickers,
        query.topCount,
        query.selectionMode,
        query.selectionDate,
        query.from,
        query.till,
        query.intervalDays,
        undefined
      );

      const data = response.data ?? {};
      const mapped: ProviderCompositionSeriesMap = {};
      Object.entries(data).forEach(([ticker, rows]) => {
        mapped[ticker] = (rows ?? []).map((row: MoexIndexTickerAnalyticsPoint) => ({
          tradeDate: row.tradeDate,
          weight: row.weight,
        }));
      });
      return mapped;
    },
  };
}

