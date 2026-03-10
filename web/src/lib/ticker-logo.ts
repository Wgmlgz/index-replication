import { getApiUrl } from '@/lib/api';

type TickerLogoResolveResponse = {
  logo_url?: string;
};

const TICKER_LOGO_RESOLVE_PATH = '/tickers/logo';
const logoUrlByTickerCache = new Map<string, string | null>();
const pendingLogoResolutions = new Map<string, Promise<string | null>>();

const ALLOWED_TICKER_PATTERN = /^[A-Z0-9._-]{1,24}$/;

export function normalizeTicker(rawTicker: string): string {
  return rawTicker.trim().toUpperCase();
}

async function resolveTickerLogoViaApi(rawTicker: string): Promise<string | null> {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker || !ALLOWED_TICKER_PATTERN.test(ticker)) return null;

  if (logoUrlByTickerCache.has(ticker)) {
    return logoUrlByTickerCache.get(ticker) ?? null;
  }

  const pending = pendingLogoResolutions.get(ticker);
  if (pending) return pending;

  const resolutionPromise = (async () => {
    try {
      const params = new URLSearchParams({ ticker });
      const response = await fetch(
        `${getApiUrl()}${TICKER_LOGO_RESOLVE_PATH}?${params.toString()}`,
        {
          credentials: 'include',
        },
      );
      if (!response.ok) {
        logoUrlByTickerCache.set(ticker, null);
        return null;
      }

      const payload = (await response.json()) as TickerLogoResolveResponse;
      const logoURL = typeof payload.logo_url === 'string' && payload.logo_url.length > 0
        ? payload.logo_url
        : null;
      logoUrlByTickerCache.set(ticker, logoURL);
      return logoURL;
    } catch {
      logoUrlByTickerCache.set(ticker, null);
      return null;
    } finally {
      pendingLogoResolutions.delete(ticker);
    }
  })();

  pendingLogoResolutions.set(ticker, resolutionPromise);
  return resolutionPromise;
}

export async function resolveTickerLogoUrl(rawTicker: string): Promise<string | null> {
  return resolveTickerLogoViaApi(rawTicker);
}
