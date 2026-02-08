import axios, { type AxiosInstance } from 'axios';

export type MoexIndex = {
  secid: string;
  shortName: string;
  name: string;
  currency: string | null;
  decimals: number | null;
  boardId: string | null;
  calcMode: string | null;
  annualHigh: number | null;
  annualLow: number | null;
};

export type MoexIndexCollection = {
  id: number;
  name: string;
  title: string;
  securityGroupId: number | null;
};

export type MoexIndexHistoryPoint = {
  tradeDate: string;
  close: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
};

export type MoexIndexCompositionEntry = {
  indexId: string;
  tradeDate: string;
  ticker: string;
  shortName: string;
  secId: string;
  weight: number | null;
  tradingSession: number | null;
  tradeSessionDate: string | null;
};

export type MoexIndexTickerAnalyticsPoint = {
  tradeDate: string;
  weight: number | null;
};

type MoexTable = {
  columns: string[];
  data: Array<Array<string | number | null>>;
};

type MoexSecuritiesResponse = {
  securities: MoexTable;
};

type MoexIndexCollectionsResponse = {
  securitycollections?: MoexTable;
};

type MoexHistoryResponse = {
  history: MoexTable;
  'history.cursor'?: MoexTable;
};

type MoexIndexAnalyticsResponse = {
  analytics: MoexTable;
  'analytics.cursor'?: MoexTable;
  'analytics.dates'?: MoexTable;
};

type MoexIndexTickerAnalyticsResponse = {
  ticker: MoexTable;
  'ticker.cursor'?: MoexTable;
};

type RequestParams = Record<
  string,
  string | number | boolean | null | undefined | Array<string | number>
>;

const resolveMoexBaseUrl = () =>
  process.env.NEXT_PUBLIC_MOEX_BASE_URL || 'https://iss.moex.com/iss';

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const tableToObjects = (table: MoexTable): Record<string, string | number | null>[] => {
  const { columns, data } = table;
  return data.map((row) => {
    const record: Record<string, string | number | null> = {};
    columns.forEach((column, index) => {
      record[column] = row[index] ?? null;
    });
    return record;
  });
};

const INDEX_COLUMNS =
  'SECID,SHORTNAME,NAME,CURRENCYID,DECIMALS,BOARDID,CALCMODE,ANNUALHIGH,ANNUALLOW';
const INDEX_SECURITY_GROUP_ID = 12;

const mapIndexes = (table: MoexTable): MoexIndex[] =>
  tableToObjects(table)
    .map((row) => ({
      secid: String(row.SECID ?? ''),
      shortName: String(row.SHORTNAME ?? row.NAME ?? ''),
      name: String(row.NAME ?? row.SHORTNAME ?? ''),
      currency: row.CURRENCYID ? String(row.CURRENCYID) : null,
      decimals: toNumber(row.DECIMALS),
      boardId: row.BOARDID ? String(row.BOARDID) : null,
      calcMode: row.CALCMODE ? String(row.CALCMODE) : null,
      annualHigh: toNumber(row.ANNUALHIGH),
      annualLow: toNumber(row.ANNUALLOW),
    }))
    .filter((row) => row.secid.length > 0);

const normalizeParams = (params?: RequestParams) => {
  if (!params) return undefined;
  const normalized: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      normalized[key] = value.join(',');
      return;
    }
    normalized[key] = String(value);
  });
  return normalized;
};

export class MoexClient {
  private http: AxiosInstance;

  constructor(baseUrl = resolveMoexBaseUrl()) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: { Accept: 'application/json' },
    });
  }

  private async request<T>(
    path: string,
    params?: RequestParams,
    signal?: AbortSignal
  ) {
    const response = await this.http.get<T>(path, {
      params: normalizeParams(params),
      signal,
    });
    return response.data;
  }

  async getIndexes(signal?: AbortSignal): Promise<MoexIndex[]> {
    const data = await this.request<MoexSecuritiesResponse>(
      'engines/stock/markets/index/securities.json',
      {
        'iss.meta': 'off',
        lang: 'ru',
        'securities.columns': INDEX_COLUMNS,
      },
      signal
    );

    return mapIndexes(data.securities);
  }

  async getIndexCollections(
    signal?: AbortSignal
  ): Promise<MoexIndexCollection[]> {
    const data = await this.request<MoexIndexCollectionsResponse>(
      'index.json',
      {
        'iss.meta': 'off',
        lang: 'ru',
      },
      signal
    );

    const table = data.securitycollections;
    if (!table) return [];

    return tableToObjects(table)
      .map((row) => ({
        id: toNumber(row.id ?? row.ID) ?? 0,
        name: String(row.name ?? row.NAME ?? ''),
        title: String(row.title ?? row.TITLE ?? row.name ?? ''),
        securityGroupId: toNumber(
          row.security_group_id ?? row.SECURITY_GROUP_ID
        ),
      }))
      .filter(
        (item) =>
          item.name.length > 0 &&
          item.securityGroupId === INDEX_SECURITY_GROUP_ID
      );
  }

  async getIndexCollectionMemberships(
    collections: Array<{ name: string }>,
    signal?: AbortSignal
  ): Promise<Record<string, string[]>> {
    if (collections.length === 0) return {};

    const responses = await Promise.all(
      collections.map(async (collection) => {
        const data = await this.request<MoexSecuritiesResponse>(
          'engines/stock/markets/index/securities.json',
          {
            'iss.meta': 'off',
            lang: 'ru',
            security_collection: collection.name,
            'securities.columns': 'SECID',
          },
          signal
        );

        const secids = tableToObjects(data.securities)
          .map((row) => String(row.SECID ?? row.secid ?? '').toUpperCase())
          .filter((value) => value.length > 0);

        return { collection: collection.name, secids };
      })
    );

    const membership: Record<string, string[]> = {};
    responses.forEach(({ collection, secids }) => {
      secids.forEach((secid) => {
        const current = membership[secid] ?? [];
        current.push(collection);
        membership[secid] = current;
      });
    });

    return membership;
  }

  async getIndexHistory(
    secid: string,
    options?: {
      from?: string;
      till?: string;
      pageSize?: number;
      signal?: AbortSignal;
    }
  ): Promise<MoexIndexHistoryPoint[]> {
    const pageSize = options?.pageSize ?? 100;
    let start = 0;
    let total: number | null = null;
    let iterations = 0;
    const results: MoexIndexHistoryPoint[] = [];

    while (iterations < 100) {
      iterations += 1;
      const data = await this.request<MoexHistoryResponse>(
        `history/engines/stock/markets/index/securities/${encodeURIComponent(secid)}.json`,
        {
          'iss.meta': 'off',
          from: options?.from,
          till: options?.till,
          limit: pageSize,
          start,
          'history.columns': 'TRADEDATE,CLOSE,OPEN,HIGH,LOW',
        },
        options?.signal
      );

      const rows = tableToObjects(data.history).map((row) => ({
        tradeDate: String(row.TRADEDATE ?? ''),
        close: toNumber(row.CLOSE),
        open: toNumber(row.OPEN),
        high: toNumber(row.HIGH),
        low: toNumber(row.LOW),
      }));
      results.push(...rows);

      const cursorTable = data['history.cursor'];
      if (cursorTable) {
        const cursorRows = tableToObjects(cursorTable);
        const cursor = cursorRows[0] ?? {};
        total = toNumber(cursor.TOTAL);
        const page = toNumber(cursor.PAGESIZE) ?? pageSize;
        start += page;
        if (total !== null && start >= total) {
          break;
        }
        if (rows.length === 0) {
          break;
        }
        continue;
      }

      break;
    }

    return results;
  }

  async getIndexComposition(
    indexId: string,
    options?: {
      date?: string;
      tickers?: string[];
      tradingSession?: number;
      pageSize?: number;
      signal?: AbortSignal;
    }
  ): Promise<MoexIndexCompositionEntry[]> {
    const pageSize = options?.pageSize ?? 100;
    let start = 0;
    let total: number | null = null;
    let iterations = 0;
    const results: MoexIndexCompositionEntry[] = [];

    while (iterations < 100) {
      iterations += 1;
      const data = await this.request<MoexIndexAnalyticsResponse>(
        `statistics/engines/stock/markets/index/analytics/${encodeURIComponent(indexId)}.json`,
        {
          'iss.meta': 'off',
          lang: 'en',
          date: options?.date,
          tickers: options?.tickers,
          tradingsession: options?.tradingSession ?? 3,
          limit: pageSize,
          start,
        },
        options?.signal
      );

      const rows = tableToObjects(data.analytics).map((row) => {
        const tradeSessionDate =
          row.trade_session_date ??
          row.TRADE_SESSION_DATE ??
          row.tradeSessionDate ??
          row.TRADESESSIONDATE;
        return {
          indexId: String(row.indexid ?? row.INDEXID ?? ''),
          tradeDate: String(row.tradedate ?? row.TRADEDATE ?? ''),
          ticker: String(row.ticker ?? row.TICKER ?? ''),
          shortName: String(
            row.shortnames ??
              row.SHORTNAMES ??
              row.shortname ??
              row.SHORTNAME ??
              ''
          ),
          secId: String(row.secids ?? row.SECIDS ?? row.secid ?? row.SECID ?? ''),
          weight: toNumber(row.weight ?? row.WEIGHT),
          tradingSession: toNumber(row.tradingsession ?? row.TRADINGSESSION),
          tradeSessionDate: tradeSessionDate ? String(tradeSessionDate) : null,
        };
      });
      results.push(
        ...rows.filter(
          (row) => row.ticker.length > 0 && row.tradeDate.length > 0
        )
      );

      const cursorTable = data['analytics.cursor'];
      if (cursorTable) {
        const cursorRows = tableToObjects(cursorTable);
        const cursor = cursorRows[0] ?? {};
        total = toNumber(cursor.TOTAL ?? cursor.total);
        const page = toNumber(cursor.PAGESIZE ?? cursor.pagesize) ?? pageSize;
        start += page;
        if (total !== null && start >= total) {
          break;
        }
        if (rows.length === 0) {
          break;
        }
        continue;
      }

      break;
    }

    return results;
  }

  async getIndexTickerAnalytics(
    indexId: string,
    ticker: string,
    options?: {
      from?: string;
      till?: string;
      tradingSession?: number;
      pageSize?: number;
      signal?: AbortSignal;
    }
  ): Promise<MoexIndexTickerAnalyticsPoint[]> {
    const pageSize = options?.pageSize ?? 100;
    let start = 0;
    let total: number | null = null;
    let iterations = 0;
    const results: MoexIndexTickerAnalyticsPoint[] = [];

    while (iterations < 100) {
      iterations += 1;
      const data = await this.request<MoexIndexTickerAnalyticsResponse>(
        `statistics/engines/stock/markets/index/analytics/${encodeURIComponent(indexId)}/tickers/${encodeURIComponent(ticker)}.json`,
        {
          'iss.meta': 'off',
          lang: 'en',
          from: options?.from,
          till: options?.till,
          tradingsession: options?.tradingSession ?? 3,
          limit: pageSize,
          start,
        },
        options?.signal
      );

      const rows = tableToObjects(data.ticker).map((row) => ({
        tradeDate: String(row.tradedate ?? row.TRADEDATE ?? ''),
        weight: toNumber(row.weight ?? row.WEIGHT),
      }));
      results.push(...rows.filter((row) => row.tradeDate.length > 0));

      const cursorTable = data['ticker.cursor'];
      if (cursorTable) {
        const cursorRows = tableToObjects(cursorTable);
        const cursor = cursorRows[0] ?? {};
        total = toNumber(cursor.TOTAL ?? cursor.total);
        const page =
          toNumber(cursor.PAGESIZE ?? cursor.pagesize) ?? pageSize;
        start += page;
        if (total !== null && start >= total) {
          break;
        }
        if (rows.length === 0) {
          break;
        }
        continue;
      }

      break;
    }

    return results;
  }

  async getIndexTickerAnalyticsSeries(
    indexId: string,
    tickers: string[],
    options?: {
      from?: string;
      till?: string;
      tradingSession?: number;
      pageSize?: number;
      signal?: AbortSignal;
    }
  ): Promise<Record<string, MoexIndexTickerAnalyticsPoint[]>> {
    if (tickers.length === 0) return {};

    const responses = await Promise.all(
      tickers.map((ticker) =>
        this.getIndexTickerAnalytics(indexId, ticker, options)
      )
    );

    const result: Record<string, MoexIndexTickerAnalyticsPoint[]> = {};
    tickers.forEach((ticker, index) => {
      result[ticker] = responses[index] ?? [];
    });
    return result;
  }
}

export const moexClient = new MoexClient();
