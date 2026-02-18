import type { ModelsMoexIndex as MoexIndex } from '@/api-client';
import type {
  FilterDefinition,
  FilterOption,
  FilterState,
  SortKey,
  SortOption,
} from './use-moex-indexes.types';

export const DEFAULT_PAGE_SIZE = 20;
export const UNCATEGORIZED_COLLECTION = '__uncategorized__';
export const EMPTY_FILTER_VALUE = '__empty__';

export const FILTER_DEFS: FilterDefinition[] = [
  {
    key: 'collections',
    labelKey: 'moex.filters.groups',
    emptyLabelKey: 'moex.groups.uncategorized',
  },
  {
    key: 'currency',
    labelKey: 'moex.filters.currency',
    emptyLabelKey: 'moex.filters.emptyCurrency',
    getValue: (index) => index.currency,
  },
  {
    key: 'board',
    labelKey: 'moex.filters.board',
    emptyLabelKey: 'moex.filters.emptyBoard',
    getValue: (index) => index.boardId,
  },
  {
    key: 'calcMode',
    labelKey: 'moex.filters.type',
    emptyLabelKey: 'moex.filters.emptyType',
    getValue: (index) => index.calcMode,
  },
];

export const createEmptyFilters = (): FilterState =>
  FILTER_DEFS.reduce((acc, def) => {
    acc[def.key] = [];
    return acc;
  }, {} as FilterState);

export const SORT_OPTIONS: SortOption[] = [
  { value: 'name-asc', labelKey: 'moex.sort.nameAsc' },
  { value: 'name-desc', labelKey: 'moex.sort.nameDesc' },
  { value: 'secid-asc', labelKey: 'moex.sort.codeAsc' },
  { value: 'secid-desc', labelKey: 'moex.sort.codeDesc' },
  { value: 'currency-asc', labelKey: 'moex.sort.currencyAsc' },
  { value: 'board-asc', labelKey: 'moex.sort.boardAsc' },
  { value: 'calc-asc', labelKey: 'moex.sort.calcAsc' },
];

export const compareStrings = (left: string, right: string) =>
  left.localeCompare(right, 'ru', { sensitivity: 'base' });

export const compareNullableStrings = (
  left: string | null | undefined,
  right: string | null | undefined
) => {
  const leftValue = left ?? '';
  const rightValue = right ?? '';
  if (!leftValue && rightValue) return 1;
  if (leftValue && !rightValue) return -1;
  return compareStrings(leftValue, rightValue);
};

export const sortComparators: Record<
  SortKey,
  (a: MoexIndex, b: MoexIndex) => number
> = {
  'name-asc': (a, b) => compareStrings(a.name, b.name),
  'name-desc': (a, b) => compareStrings(b.name, a.name),
  'secid-asc': (a, b) => compareStrings(a.secid, b.secid),
  'secid-desc': (a, b) => compareStrings(b.secid, a.secid),
  'currency-asc': (a, b) => compareNullableStrings(a.currency, b.currency),
  'board-asc': (a, b) => compareNullableStrings(a.boardId, b.boardId),
  'calc-asc': (a, b) => compareNullableStrings(a.calcMode, b.calcMode),
};

export const buildFilterOptions = (
  values: Array<string | null | undefined>,
  emptyLabel: string
): FilterOption[] => {
  const counts = new Map<string, number>();
  let emptyCount = 0;

  values.forEach((value) => {
    if (value === null || value === undefined || value === '') {
      emptyCount += 1;
      return;
    }
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const options = Array.from(counts.entries())
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([value, count]) => ({ value, label: value, count }));

  if (emptyCount > 0) {
    options.push({
      value: EMPTY_FILTER_VALUE,
      label: emptyLabel,
      count: emptyCount,
    });
  }

  return options;
};
