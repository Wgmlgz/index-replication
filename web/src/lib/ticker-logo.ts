import { getApiUrl } from '@/lib/api';

type TickerLogoResolveResponse = {
  logo_url?: string;
};

export const TICKER_LOGO_CACHE_MS = 24 * 60 * 60 * 1000;
const TICKER_LOGO_RESOLVE_PATH = '/tickers/logo';
const ALLOWED_TICKER_PATTERN = /^[A-Z0-9._-]{1,24}$/;

export function normalizeTicker(rawTicker: string): string {
  return rawTicker.trim().toUpperCase();
}

export function tickerLogoQueryKey(rawTicker: string): readonly ['ticker-logo', string] {
  return ['ticker-logo', normalizeTicker(rawTicker)];
}

export async function resolveTickerLogoUrl(rawTicker: string): Promise<string | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker || !ALLOWED_TICKER_PATTERN.test(ticker)) return null;

  try {
    const params = new URLSearchParams({ ticker });
    const response = await fetch(
      `${getApiUrl()}${TICKER_LOGO_RESOLVE_PATH}?${params.toString()}`,
      {
        credentials: 'include',
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as TickerLogoResolveResponse;
    return typeof payload.logo_url === 'string' && payload.logo_url.length > 0
      ? payload.logo_url
      : null;
  } catch {
    return null;
  }
}
