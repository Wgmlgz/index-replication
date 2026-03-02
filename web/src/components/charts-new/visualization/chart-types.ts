export type PriceSeriesType = 'line' | 'candlestick';

export type PriceLinePoint = {
  time: string;
  value: number;
};

export type PriceCandlestickPoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type PriceChartData = PriceLinePoint[] | PriceCandlestickPoint[];

export type CompositionSeriesPoint = {
  time: string;
  value: number;
};

export type CompositionSeries = {
  id: string;
  name: string;
  data: CompositionSeriesPoint[];
};

export type CompositionLegendRow = {
  ticker: string;
  name: string;
  latestWeight: number | null;
  latestDate: string | null;
  snapshotWeight: number | null;
};

export type CompositionSnapshotItem = {
  ticker: string;
  secId: string;
  name: string;
  weight: number;
  tradeDate: string;
};
