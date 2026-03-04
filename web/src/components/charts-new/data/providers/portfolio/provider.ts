import type {
  PortfolioCompositionEntry,
  PortfolioCompositionSeriesPoint,
  PortfolioHistoryPoint,
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
import { portfolioApi } from '@/lib/api';
import type { ChartsDataProvider } from '../types';

export function createPortfolioChartsDataProvider(
  portfolioID: number
): ChartsDataProvider {
  return {
    id: `portfolio:${portfolioID}`,
    getPriceHistory: async (
      query: PriceHistoryQuery
    ): Promise<ProviderPriceHistoryPoint[]> => {
      const response = await portfolioApi.mePortfoliosIdHistoryGet(
        portfolioID,
        query.from,
        query.till,
        query.intervalDays
      );
      const rows = response.data ?? [];
      return rows.map((row: PortfolioHistoryPoint) => ({
        tradeDate: row.trade_date,
        close: row.total_amount_portfolio ?? 0,
        open: null,
        high: null,
        low: null,
        currency: row.currency ?? '',
      }));
    },
    getCompositionSnapshot: async (
      query: CompositionSnapshotQuery
    ): Promise<ProviderCompositionSnapshotPoint[]> => {
      const response = await portfolioApi.mePortfoliosIdCompositionGet(
        portfolioID,
        query.selectionMode === 'fixed' ? query.selectionDate : undefined
      );
      const rows = response.data ?? [];
      return rows.map((row: PortfolioCompositionEntry) => ({
        ticker: row.ticker ?? row.instrument_id ?? '',
        secId: row.instrument_id ?? '',
        name: row.name || row.ticker || row.instrument_id || '',
        weight: row.weight ?? 0,
        tradeDate: row.trade_date ?? '',
      }));
    },
    getCompositionSeries: async (
      query: CompositionSeriesQuery
    ): Promise<ProviderCompositionSeriesMap> => {
      const response = await portfolioApi.mePortfoliosIdCompositionSeriesGet(
        portfolioID,
        query.tickers,
        query.topCount,
        query.selectionMode,
        query.selectionDate,
        query.from,
        query.till,
        query.intervalDays
      );
      const data = response.data ?? {};
      const mapped: ProviderCompositionSeriesMap = {};
      Object.entries(data).forEach(([ticker, rows]) => {
        mapped[ticker] = (rows ?? []).map(
          (row: PortfolioCompositionSeriesPoint) => ({
            tradeDate: row.trade_date,
            weight: row.weight,
          })
        );
      });
      return mapped;
    },
  };
}
