import type { MoexIndex as MoexIndex } from '@/api-client';

export type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

export type FilterKey = 'collections' | 'currency' | 'board' | 'calcMode';

export type FilterState = Record<FilterKey, string[]>;

export type FilterOptions = Record<FilterKey, FilterOption[]>;

export type FilterDefinition = {
  key: FilterKey;
  labelKey: string;
  emptyLabelKey: string;
  getValue?: (index: MoexIndex) => string | null | undefined;
};

export type LastActiveRange = '1m' | '3m' | '6m' | '1y' | 'all';

export type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'secid-asc'
  | 'secid-desc'
  | 'currency-asc'
  | 'board-asc'
  | 'calc-asc';

export type SortOption = {
  value: SortKey;
  labelKey: string;
};

export type IndexSection = {
  key: string;
  title: string;
  indexes: MoexIndex[];
  showCollections?: boolean;
};

export type MoexIndexListState = {
  query: string;
  setQuery: (value: string) => void;
  selectedSecid: string | null;
  setSelectedSecid: (value: string | null) => void;
  showFavoritesOnly: boolean;
  setShowFavoritesOnly: (value: boolean) => void;
  pageIndex: number;
  setPageIndex: (value: number) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  pageCount: number;
  showPagination: boolean;
  filters: FilterState;
  setFilter: (key: FilterKey, value: string[]) => void;
  filterOptions: FilterOptions;
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
  sortOptions: SortOption[];
  lastActiveRange: LastActiveRange;
  setLastActiveRange: (value: LastActiveRange) => void;
  compositionOnly: boolean;
  setCompositionOnly: (value: boolean) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  foundCount: number;
  isEmpty: boolean;
  showNoFavoritesMessage: boolean;
  indexesLoading: boolean;
  collectionsLoading: boolean;
  error: string | null;
  listSections: IndexSection[];
  indexCollectionsMap: Record<string, string[]>;
  favoritesSet: Set<string>;
  toggleFavorite: (secid: string) => void;
};
