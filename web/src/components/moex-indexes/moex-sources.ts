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
};
