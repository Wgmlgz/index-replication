'use client';

import type {
  FilterState,
  LastActiveRange,
  SortKey,
} from './list/use-moex-indexes.types';
import { createEmptyFilters, DEFAULT_PAGE_SIZE } from './list/use-moex-indexes.utils';
import type {
  ChartType,
  ChartViewMode,
  CompositionTab,
  IntervalKey,
  RangeKey,
} from './detail/moex-indexes-detail.types';

export type SearchParamsLike = {
  get: (key: string) => string | null;
  getAll: (key: string) => string[];
};

export const MOEX_URL_KEYS = {
  selectedSecid: 'i',

  listQuery: 'l_q',
  listFavoritesOnly: 'l_fav',
  listSort: 'l_sort',
  listPage: 'l_p', // 1-based in URL
  listPageSize: 'l_ps',
  listCollections: 'l_col',
  listCurrency: 'l_cur',
  listBoard: 'l_board',
  listCalcMode: 'l_calc',
  listLastActive: 'l_act',
  listComposition: 'l_comp',

  detailRange: 'd_range',
  detailInterval: 'd_interval',
  detailCustomFrom: 'd_from',
  detailCustomTill: 'd_till',
  detailView: 'd_view',
  detailType: 'd_type',

  compositionTab: 'c_tab',
} as const;

export type MoexIndexesUrlInitialState = {
  selectedSecid?: string | null;
  list?: Partial<{
    query: string;
    showFavoritesOnly: boolean;
    pageIndex: number;
    pageSize: number;
    sortKey: SortKey;
    filters: FilterState;
    lastActiveRange: LastActiveRange;
    compositionOnly: boolean;
  }>;
  detail?: Partial<{
    rangeKey: RangeKey;
    intervalKey: IntervalKey;
    customFrom: string;
    customTill: string;
    viewMode: ChartViewMode;
    chartType: ChartType;
    compositionTab: CompositionTab;
  }>;
};

const SORT_KEYS: SortKey[] = [
  'name-asc',
  'name-desc',
  'secid-asc',
  'secid-desc',
  'currency-asc',
  'board-asc',
  'calc-asc',
];

const LAST_ACTIVE_RANGES: LastActiveRange[] = ['1m', '3m', '6m', '1y', 'all'];

const RANGE_KEYS: RangeKey[] = [
  '1m',
  '3m',
  '6m',
  'ytd',
  '1y',
  '3y',
  '5y',
  'max',
  'custom',
];

const INTERVAL_KEYS: IntervalKey[] = [
  'auto',
  '1d',
  '2d',
  '3d',
  '1w',
  '2w',
  '1m',
];

const CHART_VIEW_MODES: ChartViewMode[] = ['price', 'percent'];
const CHART_TYPES: ChartType[] = ['line', 'candlestick'];
const COMPOSITION_TABS: CompositionTab[] = ['snapshot', 'trend', 'stacked'];

const isOneOf = <T extends string>(value: string | null, options: T[]): value is T =>
  value !== null && options.includes(value as T);

const parseBoolean = (value: string | null): boolean | undefined => {
  if (value === null) return undefined;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return undefined;
};

const parsePositiveInt = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed <= 0) return undefined;
  return parsed;
};

const normalizeList = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const v = String(value ?? '').trim();
    if (!v) return;
    if (seen.has(v)) return;
    seen.add(v);
    result.push(v);
  });
  result.sort((a, b) => a.localeCompare(b));
  return result;
};

export function parseMoexIndexesUrlState(
  searchParams: SearchParamsLike | null
): MoexIndexesUrlInitialState {
  if (!searchParams) return {};

  const selectedSecidRaw = searchParams.get(MOEX_URL_KEYS.selectedSecid);
  const selectedSecid =
    selectedSecidRaw && selectedSecidRaw.trim()
      ? selectedSecidRaw.trim().toUpperCase()
      : undefined;

  const query = searchParams.get(MOEX_URL_KEYS.listQuery);
  const showFavoritesOnly = parseBoolean(
    searchParams.get(MOEX_URL_KEYS.listFavoritesOnly)
  );

  const sortKeyRaw = searchParams.get(MOEX_URL_KEYS.listSort);
  const sortKey = isOneOf(sortKeyRaw, SORT_KEYS) ? sortKeyRaw : undefined;

  const page1Based = parsePositiveInt(searchParams.get(MOEX_URL_KEYS.listPage));
  const pageIndex =
    page1Based !== undefined ? Math.max(0, page1Based - 1) : undefined;

  const pageSize = parsePositiveInt(searchParams.get(MOEX_URL_KEYS.listPageSize));

  const collections = normalizeList(searchParams.getAll(MOEX_URL_KEYS.listCollections));
  const currency = normalizeList(searchParams.getAll(MOEX_URL_KEYS.listCurrency));
  const board = normalizeList(searchParams.getAll(MOEX_URL_KEYS.listBoard));
  const calcMode = normalizeList(searchParams.getAll(MOEX_URL_KEYS.listCalcMode));
  const lastActiveRaw = searchParams.get(MOEX_URL_KEYS.listLastActive);
  const lastActiveRange = isOneOf(lastActiveRaw, LAST_ACTIVE_RANGES)
    ? lastActiveRaw
    : undefined;
  const compositionRaw = searchParams.get(MOEX_URL_KEYS.listComposition);
  const compositionNormalized = compositionRaw?.toLowerCase();
  const compositionParsed = parseBoolean(compositionRaw);
  const compositionOnly =
    compositionParsed !== undefined
      ? compositionParsed
      : compositionNormalized === 'with'
        ? true
        : compositionNormalized === 'all' || compositionNormalized === 'without'
          ? false
          : undefined;

  const hasAnyFilters =
    collections.length > 0 || currency.length > 0 || board.length > 0 || calcMode.length > 0;
  const filters = hasAnyFilters
    ? ({
        ...createEmptyFilters(),
        collections,
        currency,
        board,
        calcMode,
      } satisfies FilterState)
    : undefined;

  const rangeRaw = searchParams.get(MOEX_URL_KEYS.detailRange);
  const rangeKey = isOneOf(rangeRaw, RANGE_KEYS) ? rangeRaw : undefined;

  const intervalRaw = searchParams.get(MOEX_URL_KEYS.detailInterval);
  const intervalKey = isOneOf(intervalRaw, INTERVAL_KEYS) ? intervalRaw : undefined;

  const customFrom = searchParams.get(MOEX_URL_KEYS.detailCustomFrom) ?? undefined;
  const customTill = searchParams.get(MOEX_URL_KEYS.detailCustomTill) ?? undefined;

  const viewRaw = searchParams.get(MOEX_URL_KEYS.detailView);
  const viewMode = isOneOf(viewRaw, CHART_VIEW_MODES) ? viewRaw : undefined;

  const typeRaw = searchParams.get(MOEX_URL_KEYS.detailType);
  const chartType = isOneOf(typeRaw, CHART_TYPES) ? typeRaw : undefined;

  const tabRaw = searchParams.get(MOEX_URL_KEYS.compositionTab);
  const compositionTab = isOneOf(tabRaw, COMPOSITION_TABS) ? tabRaw : undefined;

  const listState: MoexIndexesUrlInitialState['list'] = {};
  if (typeof query === 'string' && query.length > 0) listState.query = query;
  if (typeof showFavoritesOnly === 'boolean') listState.showFavoritesOnly = showFavoritesOnly;
  if (typeof pageIndex === 'number') listState.pageIndex = pageIndex;
  if (typeof pageSize === 'number' && pageSize > 0) listState.pageSize = pageSize;
  if (sortKey) listState.sortKey = sortKey;
  if (filters) listState.filters = filters;
  if (lastActiveRange) listState.lastActiveRange = lastActiveRange;
  if (typeof compositionOnly === 'boolean') {
    listState.compositionOnly = compositionOnly;
  }

  const detailState: MoexIndexesUrlInitialState['detail'] = {};
  if (rangeKey) detailState.rangeKey = rangeKey;
  if (intervalKey) detailState.intervalKey = intervalKey;
  if (customFrom) detailState.customFrom = customFrom;
  if (customTill) detailState.customTill = customTill;
  if (viewMode) detailState.viewMode = viewMode;
  if (chartType) detailState.chartType = chartType;
  if (compositionTab) detailState.compositionTab = compositionTab;

  return {
    selectedSecid: selectedSecid ?? null,
    list: Object.keys(listState).length > 0 ? listState : undefined,
    detail: Object.keys(detailState).length > 0 ? detailState : undefined,
  };
}

const appendSorted = (params: URLSearchParams, key: string, values: string[]) => {
  const normalized = normalizeList(values);
  normalized.forEach((value) => params.append(key, value));
};

export function applyMoexIndexesUrlState(
  params: URLSearchParams,
  state: {
    selectedSecid: string | null;
    list: {
      query: string;
      showFavoritesOnly: boolean;
      pageIndex: number;
      pageSize: number;
      sortKey: SortKey;
      filters: FilterState;
      lastActiveRange: LastActiveRange;
      compositionOnly: boolean;
    };
    detail: {
      rangeKey: RangeKey;
      intervalKey: IntervalKey;
      customFrom: string;
      customTill: string;
      viewMode: ChartViewMode;
      chartType: ChartType;
      compositionTab: CompositionTab;
    };
  }
) {
  const deleteKeys: string[] = [
    MOEX_URL_KEYS.selectedSecid,
    MOEX_URL_KEYS.listQuery,
    MOEX_URL_KEYS.listFavoritesOnly,
    MOEX_URL_KEYS.listSort,
    MOEX_URL_KEYS.listPage,
    MOEX_URL_KEYS.listPageSize,
    MOEX_URL_KEYS.listCollections,
    MOEX_URL_KEYS.listCurrency,
    MOEX_URL_KEYS.listBoard,
    MOEX_URL_KEYS.listCalcMode,
    MOEX_URL_KEYS.listLastActive,
    MOEX_URL_KEYS.listComposition,
    MOEX_URL_KEYS.detailRange,
    MOEX_URL_KEYS.detailInterval,
    MOEX_URL_KEYS.detailCustomFrom,
    MOEX_URL_KEYS.detailCustomTill,
    MOEX_URL_KEYS.detailView,
    MOEX_URL_KEYS.detailType,
    MOEX_URL_KEYS.compositionTab,
  ];
  deleteKeys.forEach((key) => params.delete(key));

  if (state.selectedSecid) {
    params.set(MOEX_URL_KEYS.selectedSecid, state.selectedSecid.toUpperCase());
  }

  if (state.list.query.trim().length > 0) {
    params.set(MOEX_URL_KEYS.listQuery, state.list.query.trim());
  }
  if (state.list.showFavoritesOnly) {
    params.set(MOEX_URL_KEYS.listFavoritesOnly, '1');
  }
  if (state.list.sortKey !== 'name-asc') {
    params.set(MOEX_URL_KEYS.listSort, state.list.sortKey);
  }

  if (state.list.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set(MOEX_URL_KEYS.listPageSize, String(state.list.pageSize));
  }
  if (state.list.pageIndex > 0) {
    params.set(MOEX_URL_KEYS.listPage, String(state.list.pageIndex + 1));
  }

  appendSorted(params, MOEX_URL_KEYS.listCollections, state.list.filters.collections);
  appendSorted(params, MOEX_URL_KEYS.listCurrency, state.list.filters.currency);
  appendSorted(params, MOEX_URL_KEYS.listBoard, state.list.filters.board);
  appendSorted(params, MOEX_URL_KEYS.listCalcMode, state.list.filters.calcMode);
  if (state.list.lastActiveRange !== '1m') {
    params.set(MOEX_URL_KEYS.listLastActive, state.list.lastActiveRange);
  }
  if (state.list.compositionOnly) {
    params.set(MOEX_URL_KEYS.listComposition, '1');
  }

  if (state.detail.rangeKey !== '1y') {
    params.set(MOEX_URL_KEYS.detailRange, state.detail.rangeKey);
  }
  if (state.detail.intervalKey !== 'auto') {
    params.set(MOEX_URL_KEYS.detailInterval, state.detail.intervalKey);
  }
  if (state.detail.rangeKey === 'custom') {
    if (state.detail.customFrom.trim().length > 0) {
      params.set(MOEX_URL_KEYS.detailCustomFrom, state.detail.customFrom.trim());
    }
    if (state.detail.customTill.trim().length > 0) {
      params.set(MOEX_URL_KEYS.detailCustomTill, state.detail.customTill.trim());
    }
  }
  if (state.detail.viewMode !== 'price') {
    params.set(MOEX_URL_KEYS.detailView, state.detail.viewMode);
  }
  if (state.detail.chartType !== 'line') {
    params.set(MOEX_URL_KEYS.detailType, state.detail.chartType);
  }
  if (state.detail.compositionTab !== 'snapshot') {
    params.set(MOEX_URL_KEYS.compositionTab, state.detail.compositionTab);
  }
}

export function canonicalizeSearchParams(params: URLSearchParams) {
  const entries = Array.from(params.entries()).sort(([ak, av], [bk, bv]) => {
    if (ak === bk) return av.localeCompare(bv);
    return ak.localeCompare(bk);
  });
  const out = new URLSearchParams();
  entries.forEach(([k, v]) => out.append(k, v));
  return out.toString();
}
