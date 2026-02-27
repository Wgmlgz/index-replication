export type CompositionSeriesPoint = {
  time: string;
  value: number;
};

export type CompositionSeries = {
  id: string;
  name: string;
  data: CompositionSeriesPoint[];
};

export type CompositionSnapshotItem = {
  ticker: string;
  secId: string;
  name: string;
  weight: number;
  tradeDate: string;
};
