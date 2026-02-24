# T-Bank Invest Integration Checklist

Last verified: 2026-02-24.

## 1) Decide transport first

- Use `REST` for fast prototyping and debugging.
- Use `gRPC` for long-term production performance.
- Use `WebSocket` streams for low-latency updates (market data / states).

## 2) Minimal REST request shape

REST paths follow the service/method naming pattern:

`/rest/tinkoff.public.invest.api.contract.v1.<Service>/<Method>`

Example (candles):

```bash
curl -X POST \
  "https://invest-public-api.tbank.ru/rest/tinkoff.public.invest.api.contract.v1.MarketDataService/GetCandles" \
  -H "Authorization: Bearer ${T_INVEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "instrumentId": "BBG004730N88",
    "from": "2026-02-20T00:00:00Z",
    "to": "2026-02-24T00:00:00Z",
    "interval": "CANDLE_INTERVAL_5_MIN"
  }'
```

## 3) Token and environment checklist

- Create and store separate tokens for `sandbox` and `production`.
- Never mix sandbox token with production endpoints.
- Keep token in env var or secret vault (not in repo).
- Validate auth early with a simple method like accounts or instruments lookup.

## 4) Limits to design around

From current docs:

- Recommended aggregate load from one IP: keep under `50 requests/sec`.
- Unary per-minute limits vary by service.
- For many workflows, the first hard limit is order placement (`postOrder`) and market data burst traffic.

Plan:

- Add retry with backoff for transient failures and rate-limit responses.
- Add request budget per service (market data, orders, portfolio).
- Add queueing/throttling layer for order bursts.

## 5) MOEX index strategy -> execution bridge

1. Build analytics from MOEX index series.
2. Convert signal into tradable instrument universe (futures/ETF/stocks).
3. Resolve instrument identifiers (FIGI/UID) through Instruments methods.
4. Fetch account and positions before order placement.
5. Submit/cancel orders via Orders methods.
6. Reconcile with portfolio/operations responses after execution events.

## 6) Suggested first implementation slice

1. `UsersService_GetAccounts`
2. `InstrumentsService_FindInstrument`
3. `MarketDataService_GetCandles`
4. `OrdersService_PostOrder` in sandbox
5. `OrdersService_CancelOrder` in sandbox

Success criteria:

- End-to-end: signal -> test order -> cancel -> portfolio/operations check.

