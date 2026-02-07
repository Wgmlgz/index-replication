import type { MoexIndex } from '@/lib/moex-client';
import type { ChartPoint } from './index-chart';

export type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

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
  label: string;
};

export type IndexGroup = {
  key: string;
  title: string;
  indexes: MoexIndex[];
};

export type MoexIndexesState = {
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
  collectionOptions: FilterOption[];
  selectedCollections: string[];
  setSelectedCollections: (value: string[]) => void;
  currencyOptions: FilterOption[];
  selectedCurrencies: string[];
  setSelectedCurrencies: (value: string[]) => void;
  boardOptions: FilterOption[];
  selectedBoards: string[];
  setSelectedBoards: (value: string[]) => void;
  calcModeOptions: FilterOption[];
  selectedCalcModes: string[];
  setSelectedCalcModes: (value: string[]) => void;
  sortKey: SortKey;
  setSortKey: (value: SortKey) => void;
  sortOptions: SortOption[];
  hasActiveFilters: boolean;
  clearFilters: () => void;
  foundCount: number;
  isEmpty: boolean;
  showNoFavoritesMessage: boolean;
  indexesLoading: boolean;
  collectionsLoading: boolean;
  historyLoading: boolean;
  error: string | null;
  favoriteIndexes: MoexIndex[];
  collectionGroups: IndexGroup[];
  indexCollectionsMap: Record<string, string[]>;
  favoritesSet: Set<string>;
  toggleFavorite: (secid: string) => void;
  selectedIndex: MoexIndex | null;
  selectedIndexCollections: string[];
  chartData: ChartPoint[];
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
};
