# Rebalancing Planning Signature

This page defines the pure planning contract intended for algorithm implementations.

It intentionally excludes orchestration/snapshot fields such as:
- `asOfAt`
- `modeKey`
- `modeParams`
- instrument metadata fields not used by planning math (for example `source`)

## Pure Function Shape

```ts
type PlanPure = (input: {
  investableCapital: number;

  holdings: {
    ticker: string;
    instrumentID: string;
    currentQuantity: number;
  }[];

  benchmark: {
    ticker: string;
    instrumentID: string;
    targetWeight: number;
  }[];

  instruments: {
    ticker: string;
    instrumentID: string;
    price: number;
    currency: string;
    lotSize: number;
  }[];

  money: {
    currency: string;
    available: number;
    blocked: number;
  }[];

  quantityPrecision: number;
}) => {
  items: {
    ticker: string;
    instrumentID: string;
    side: "buy" | "sell";
    currentQuantity: number;
    targetQuantity: number;
    deltaQuantity: number;
    currentWeight: number;
    targetWeight: number;
    idealWeight: number;
    referencePrice: number | null;
    plannedAmount: number | null;
    status: "planned" | "unresolved";
  }[];

  warnings: string[];

  money: {
    currency: string;
    available: number;
    blocked: number;
  }[];
};
```

## Extension Guidance

When adding a new planning algorithm, keep this signature stable and vary only the calculation strategy.

