import { axiosClient, getApiUrl } from '@/lib/api';

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
  lastActiveDate: string | null;
  hasComposition: boolean;
};

export type MoexIndexCollection = {
  id: number;
  name: string;
  title: string;
  securityGroupId: number | null;
};

export type MoexIndexesOverview = {
  indexes: MoexIndex[];
  collections: MoexIndexCollection[];
  memberships: Record<string, string[]>;
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
  tradeSessionDate: string | null;
};

export type MoexIndexTickerAnalyticsPoint = {
  tradeDate: string;
  weight: number | null;
};

type RequestParams = Record<
  string,
  string | number | boolean | null | undefined | Array<string | number>
>;

const resolveApiBaseUrl = () => getApiUrl();

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

const joinUrl = (baseUrl: string, path: string) => {
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
};

export class MoexClient {
  private baseUrl: string;

  constructor(baseUrl = resolveApiBaseUrl()) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, params?: RequestParams, signal?: AbortSignal) {
    const response = await axiosClient.get<T>(joinUrl(this.baseUrl, path), {
      params: normalizeParams(params),
      signal,
    });
    return response.data;
  }

  async getOverview(lang = 'ru', signal?: AbortSignal): Promise<MoexIndexesOverview> {
    return this.request<MoexIndexesOverview>(
      'moex/indexes/overview',
      { lang },
      signal
    );
  }

  async getIndexHistory(
    secid: string,
    options?: {
      from?: string;
      till?: string;
      intervalDays?: number;
      signal?: AbortSignal;
    }
  ): Promise<MoexIndexHistoryPoint[]> {
    return this.request<MoexIndexHistoryPoint[]>(
      `moex/indexes/${encodeURIComponent(secid)}/history`,
      {
        from: options?.from,
        till: options?.till,
        intervalDays: options?.intervalDays,
      },
      options?.signal
    );
  }

  async getIndexComposition(
    indexId: string,
    options?: {
      date?: string;
      lang?: string;
      signal?: AbortSignal;
    }
  ): Promise<MoexIndexCompositionEntry[]> {
    return this.request<MoexIndexCompositionEntry[]>(
      `moex/indexes/${encodeURIComponent(indexId)}/composition`,
      {
        date: options?.date,
        lang: options?.lang,
      },
      options?.signal
    );
  }

  async getIndexTickerAnalyticsSeries(
    indexId: string,
    tickers: string[],
    options?: {
      from?: string;
      till?: string;
      intervalDays?: number;
      lang?: string;
      signal?: AbortSignal;
    }
  ): Promise<Record<string, MoexIndexTickerAnalyticsPoint[]>> {
    if (tickers.length === 0) return {};
    return this.request<Record<string, MoexIndexTickerAnalyticsPoint[]>>(
      `moex/indexes/${encodeURIComponent(indexId)}/composition/series`,
      {
        tickers,
        from: options?.from,
        till: options?.till,
        intervalDays: options?.intervalDays,
        lang: options?.lang,
      },
      options?.signal
    );
  }
}

export const moexClient = new MoexClient();
