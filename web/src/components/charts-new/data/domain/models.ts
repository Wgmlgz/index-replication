export type ProviderPriceHistoryPoint = {
  tradeDate?: string;
  close?: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
};

export type ProviderCompositionSnapshotPoint = {
  ticker?: string;
  secId?: string;
  name?: string;
  weight?: number;
  tradeDate?: string;
};

export type ProviderCompositionSeriesPoint = {
  tradeDate?: string;
  weight?: number;
};

export type ProviderCompositionSeriesMap = Record<
  string,
  ProviderCompositionSeriesPoint[]
>;

