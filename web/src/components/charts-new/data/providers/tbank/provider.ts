import type {
  TBankPortfolioCompositionEntry,
  TBankPortfolioCompositionSeriesPoint,
  TBankPortfolioHistoryPoint,
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
import { tbankApi } from '@/lib/api';
import type { ChartsDataProvider } from '../types';

const TBANK_PROVIDER_ID = 'tbank';

export function createTbankChartsDataProvider(): ChartsDataProvider {
  return {
    id: TBANK_PROVIDER_ID,
    getPriceHistory: async (
      query: PriceHistoryQuery
    ): Promise<ProviderPriceHistoryPoint[]> => {
      const response = await tbankApi.meTbankPortfolioHistoryGet(
        query.secid || undefined,
        query.from,
        query.till,
        query.intervalDays
      );
      const rows = response.data ?? [];

      return rows.map((row: TBankPortfolioHistoryPoint) => ({
        tradeDate: row.trade_date,
        close: row.total_amount_portfolio ?? 0,
        open: null,
        high: null,
        low: null,
        currency: row.total_amount_portfolio_currency ?? '',
      }));
    },
    getCompositionSnapshot: async (
      query: CompositionSnapshotQuery
    ): Promise<ProviderCompositionSnapshotPoint[]> => {
      const response = await tbankApi.meTbankPortfolioCompositionGet(
        query.secid || undefined,
        query.selectionMode === 'fixed' ? query.selectionDate : undefined
      );
      const rows = response.data ?? [];

      return rows.map((row: TBankPortfolioCompositionEntry) => ({
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
      const response = await tbankApi.meTbankPortfolioCompositionSeriesGet(
        query.secid || undefined,
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
          (row: TBankPortfolioCompositionSeriesPoint) => ({
            tradeDate: row.trade_date,
            weight: row.weight,
          })
        );
      });
      return mapped;
    },
  };
}
