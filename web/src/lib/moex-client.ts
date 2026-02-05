import axios, { type AxiosInstance } from 'axios';

export type MoexIndex = {
  secid: string;
  shortName: string;
  name: string;
  currency: string | null;
  decimals: number | null;
};

export type MoexIndexHistoryPoint = {
  tradeDate: string;
  close: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
};

type MoexTable = {
  columns: string[];
  data: Array<Array<string | number | null>>;
};

type MoexSecuritiesResponse = {
  securities: MoexTable;
};

type MoexHistoryResponse = {
  history: MoexTable;
  'history.cursor'?: MoexTable;
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
        'securities.columns': 'SECID,SHORTNAME,NAME,CURRENCYID,DECIMALS',
      },
      signal
    );

    return tableToObjects(data.securities)
      .map((row) => ({
        secid: String(row.SECID ?? ''),
        shortName: String(row.SHORTNAME ?? row.NAME ?? ''),
        name: String(row.NAME ?? row.SHORTNAME ?? ''),
        currency: row.CURRENCYID ? String(row.CURRENCYID) : null,
        decimals: toNumber(row.DECIMALS),
      }))
      .filter((row) => row.secid.length > 0);
  }

  async getIndexHistory(
    secid: string,
    options?: { from?: string; till?: string; signal?: AbortSignal }
  ): Promise<MoexIndexHistoryPoint[]> {
    const pageSize = 100;
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
}

export const moexClient = new MoexClient();
