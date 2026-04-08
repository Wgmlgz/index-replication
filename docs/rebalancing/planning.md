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

## Current `full` Strategy

The current `full` planner uses a lot-aware integer allocation heuristic per currency bucket:

- Build the symbol universe from `holdings + benchmark` and merge identities by ticker (holding identity wins).
- Convert target weights to target dollars from `investableCapital`.
- Initial target quantity is floor-to-lot (`lotSize`) for each symbol.
- Refine by greedily adding one lot at a time to the symbol that best improves L1 dollar error.
- Convert target quantities to rebalance deltas and classify items:
  - `planned`: price is known and required buy is affordable from `cash + planned sells`.
  - `unresolved` with `reason=missing_reference_price`: benchmark target exists but no price.
  - `unresolved` with `reason=insufficient_cash`: buy delta exists but not affordable in that currency bucket.

Notes:
- Zero-delta rows are kept in output for deterministic auditability.
- Money output is updated from planned (not unresolved) trade cash flow.
- Snapshot instrument `lotSize` is sourced from MOEX shares security metadata (board-level lot size); when unavailable, it falls back to `1`.
