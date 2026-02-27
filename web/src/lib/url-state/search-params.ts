export type SearchParamsLike = {
  get: (key: string) => string | null;
  getAll: (key: string) => string[];
};

export const isOneOf = <T extends string>(
  value: string | null,
  options: readonly T[]
): value is T => value !== null && options.includes(value as T);

export const parseBoolean = (value: string | null): boolean | undefined => {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return undefined;
};

export const parsePositiveInt = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

export const normalizeList = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach(value => {
    const normalized = String(value ?? '').trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  result.sort((a, b) => a.localeCompare(b));
  return result;
};

export function canonicalizeSearchParams(params: URLSearchParams) {
  const entries = Array.from(params.entries()).sort(([ak, av], [bk, bv]) => {
    if (ak === bk) return av.localeCompare(bv);
    return ak.localeCompare(bk);
  });

  const out = new URLSearchParams();
  entries.forEach(([key, value]) => out.append(key, value));
  return out.toString();
}
