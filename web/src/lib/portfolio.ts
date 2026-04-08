export const PORTFOLIO_ID_QUERY_KEY = 'portfolio_id';
export const LAST_SELECTED_PORTFOLIO_STORAGE_KEY = 'portfolio:last-selected';
export const LAST_SELECTED_PORTFOLIO_EVENT = 'portfolio:last-selected-updated';

export type LastSelectedPortfolio = {
  id: number;
  name: string;
};

export const PORTFOLIO_V2_PROFILES_QUERY_KEY = ['portfolio', 'profiles'] as const;

export const PORTFOLIO_V2_ROUTES = {
  root: '/portfolio',
  overview: '/portfolio/overview',
  overviewOperations: '/portfolio/overview/operations',
  overviewCompare: '/portfolio/overview/compare',
  overviewAnalytics: '/portfolio/overview/analytics',
  actions: '/portfolio/actions',
  replication: '/portfolio/replication',
  replicationDrafts: '/portfolio/replication/drafts',
  profiles: '/portfolio/profiles',
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

export function readLastSelectedPortfolio(): LastSelectedPortfolio | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LAST_SELECTED_PORTFOLIO_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    const id = Number(candidate.id);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    return {
      id,
      name,
    };
  } catch {
    return null;
  }
}

export function writeLastSelectedPortfolio(next: LastSelectedPortfolio): void {
  if (typeof window === 'undefined') {
    return;
  }

  const id = Number(next.id);
  if (!Number.isInteger(id) || id <= 0) {
    return;
  }

  try {
    const payload: LastSelectedPortfolio = {
      id,
      name: next.name.trim(),
    };
    const serialized = JSON.stringify(payload);
    window.localStorage.setItem(LAST_SELECTED_PORTFOLIO_STORAGE_KEY, serialized);
    window.dispatchEvent(new CustomEvent(LAST_SELECTED_PORTFOLIO_EVENT, { detail: payload }));
  } catch {
    // Ignore storage errors.
  }
}
