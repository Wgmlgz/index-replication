import type { MoexIndexListState } from './use-moex-indexes.types';
import { SORT_OPTIONS, createEmptyFilters } from './use-moex-indexes.utils';

const EMPTY_FILTER_OPTIONS = {
  collections: [],
  currency: [],
  board: [],
  calcMode: [],
};

export const createStorybookMoexListState = (
  overrides: Partial<MoexIndexListState> = {}
): MoexIndexListState => ({
  query: '',
  setQuery: () => undefined,
  selectedSecid: null,
  setSelectedSecid: () => undefined,
  showFavoritesOnly: false,
  setShowFavoritesOnly: () => undefined,
  pageIndex: 0,
  setPageIndex: () => undefined,
  pageSize: 20,
  setPageSize: () => undefined,
  pageCount: 1,
  showPagination: false,
  filters: createEmptyFilters(),
  setFilter: () => undefined,
  filterOptions: EMPTY_FILTER_OPTIONS,
  sortKey: 'name-asc',
  setSortKey: () => undefined,
  sortOptions: SORT_OPTIONS,
  lastActiveRange: 'all',
  setLastActiveRange: () => undefined,
  compositionOnly: false,
  setCompositionOnly: () => undefined,
  hasActiveFilters: false,
  clearFilters: () => undefined,
  foundCount: 1,
  isEmpty: false,
  showNoFavoritesMessage: false,
  indexesLoading: false,
  collectionsLoading: false,
  error: null,
  listSections: [],
  indexCollectionsMap: {},
  favoritesSet: new Set<string>(),
  toggleFavorite: () => undefined,
  ...overrides,
});
