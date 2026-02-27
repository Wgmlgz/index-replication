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
  CompositionSelectionMode,
  IntervalKey,
  RangeKey,
} from './detail/moex-indexes-detail.types';
import {
  applyChartControlsUrlState,
  parseChartControlsUrlState,
  type ChartControlsUrlCodecConfig,
} from '@/lib/charting/chart-controls-url-state';
import {
  isOneOf,
  normalizeList,
  parseBoolean,
  parsePositiveInt,
  type SearchParamsLike,
} from '@/lib/url-state/search-params';
export { canonicalizeSearchParams } from '@/lib/url-state/search-params';

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
  compositionSelectionMode: 'c_mode',
  compositionSelectionDate: 'c_date',
  compositionTopN: 'topN',
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
    compositionSelectionMode: CompositionSelectionMode;
    compositionSelectionDate: string;
    compositionTopCount: number | null;
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

const MOEX_CHART_CONTROLS_URL_CODEC = {
  keys: {
    rangeKey: MOEX_URL_KEYS.detailRange,
    intervalKey: MOEX_URL_KEYS.detailInterval,
    customFrom: MOEX_URL_KEYS.detailCustomFrom,
    customTill: MOEX_URL_KEYS.detailCustomTill,
    viewMode: MOEX_URL_KEYS.detailView,
    chartType: MOEX_URL_KEYS.detailType,
    compositionTab: MOEX_URL_KEYS.compositionTab,
    compositionSelectionMode: MOEX_URL_KEYS.compositionSelectionMode,
    compositionSelectionDate: MOEX_URL_KEYS.compositionSelectionDate,
    compositionTopCount: MOEX_URL_KEYS.compositionTopN,
  },
  defaults: {
    rangeKey: '1y',
    intervalKey: 'auto',
    viewMode: 'price',
    chartType: 'line',
    compositionTab: 'snapshot',
    compositionSelectionMode: 'fixed',
    compositionTopCount: 10,
  },
} satisfies ChartControlsUrlCodecConfig;

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

  const parsedDetail = parseChartControlsUrlState(
    searchParams,
    MOEX_CHART_CONTROLS_URL_CODEC
  );

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
  if (parsedDetail.rangeKey) detailState.rangeKey = parsedDetail.rangeKey;
  if (parsedDetail.intervalKey) detailState.intervalKey = parsedDetail.intervalKey;
  if (parsedDetail.customFrom) detailState.customFrom = parsedDetail.customFrom;
  if (parsedDetail.customTill) detailState.customTill = parsedDetail.customTill;
  if (parsedDetail.viewMode) detailState.viewMode = parsedDetail.viewMode;
  if (parsedDetail.chartType) detailState.chartType = parsedDetail.chartType;
  if (parsedDetail.compositionTab) {
    detailState.compositionTab = parsedDetail.compositionTab;
  }
  if (parsedDetail.compositionSelectionMode) {
    detailState.compositionSelectionMode = parsedDetail.compositionSelectionMode;
  }
  if (parsedDetail.compositionSelectionDate) {
    detailState.compositionSelectionDate = parsedDetail.compositionSelectionDate;
  }
  if (
    parsedDetail.compositionTopCount === null ||
    typeof parsedDetail.compositionTopCount === 'number'
  ) {
    detailState.compositionTopCount = parsedDetail.compositionTopCount;
  }

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
      compositionSelectionMode: CompositionSelectionMode;
      compositionSelectionDate: string;
      compositionTopCount: number | null;
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

  applyChartControlsUrlState(params, state.detail, MOEX_CHART_CONTROLS_URL_CODEC);
}
