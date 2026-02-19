const MOEX_SITE_BASE_URL = 'https://www.moex.com';

const buildMoexSiteUrl = (path: string): string => {
  const url = new URL(path, MOEX_SITE_BASE_URL);
  return url.toString();
};

export const moexSourceLinks = {
  overview: buildMoexSiteUrl('/en/indices'),
  indexList: buildMoexSiteUrl('/en/indices'),
  indexPage: (secid: string) =>
    buildMoexSiteUrl(`/en/index/${encodeURIComponent(secid)}`),
  indexConstituents: (secid: string) =>
    buildMoexSiteUrl(`/en/index/${encodeURIComponent(secid)}/constituents`),
  issuePage: (ticker: string, board = 'EQWY') =>
    buildMoexSiteUrl(
      `/en/issue.aspx?board=${encodeURIComponent(board)}&code=${encodeURIComponent(ticker)}`
    ),
};
