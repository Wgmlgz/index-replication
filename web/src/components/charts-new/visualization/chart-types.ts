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

export type PriceLineSeriesOptions = {
  color?: string;
  lineWidth?: 1 | 2 | 3 | 4;
};

export type PriceCandlestickSeriesOptions = {
  upColor?: string;
  downColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  borderVisible?: boolean;
};

export type PriceVisualizationSeries =
  | {
      id: string;
      type: 'line';
      data: PriceLinePoint[];
      options?: PriceLineSeriesOptions;
    }
  | {
      id: string;
      type: 'candlestick';
      data: PriceCandlestickPoint[];
      options?: PriceCandlestickSeriesOptions;
    };

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
