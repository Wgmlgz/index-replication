export const PORTFOLIO_ID_QUERY_KEY = 'portfolio_id';

export const PORTFOLIO_V2_PROFILES_QUERY_KEY = ['portfolio-v2', 'profiles'] as const;

export const PORTFOLIO_V2_ROUTES = {
  root: '/portfolio-v2',
  overview: '/portfolio-v2/overview',
  profiles: '/portfolio-v2/profiles',
} as const;

export type PortfolioUrlState = {
  portfolioID?: number;
};

export function parsePortfolioID(value?: string | null): number | null {
  const rawID = value?.trim();
  if (!rawID) {
    return null;
  }

  const parsedID = Number.parseInt(rawID, 10);
  if (!Number.isFinite(parsedID) || parsedID <= 0) {
    return null;
  }

  return parsedID;
}

export function parsePortfolioUrlState(searchParams: URLSearchParams): PortfolioUrlState {
  const portfolioID = parsePortfolioID(searchParams.get(PORTFOLIO_ID_QUERY_KEY));
  return portfolioID ? { portfolioID } : {};
}

export function buildPortfolioHref(pathname: string, portfolioID?: number | null): string {
  const [basePath, queryString = ''] = pathname.split('?');
  const params = new URLSearchParams(queryString);

  if (!portfolioID) {
    params.delete(PORTFOLIO_ID_QUERY_KEY);
  } else {
    params.set(PORTFOLIO_ID_QUERY_KEY, String(portfolioID));
  }

  const nextQuery = params.toString();
  return nextQuery ? `${basePath}?${nextQuery}` : basePath;
}
