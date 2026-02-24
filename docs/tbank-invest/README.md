# T-Bank Invest API Research (for MOEX index project)

Last verified: 2026-02-24.

This folder contains practical notes and verified links for integrating T-Bank Invest API into this project.

## 1) Official docs and portals

- Main intro: https://developer.tbank.ru/invest/intro/intro/
- Interactive API explorer: https://developer.tbank.ru/invest/api
- Protocols and endpoints (gRPC/REST/WebSocket): https://developer.tbank.ru/invest/intro/developer/protocols/
- REST + Swagger usage guide: https://developer.tbank.ru/invest/intro/developer/protocols/restapi/
- Token guide: https://developer.tbank.ru/invest/intro/intro/token
- Limits: https://developer.tbank.ru/invest/intro/intro/limits
- Sandbox docs: https://developer.tbank.ru/invest/intro/developer/sandbox/

## 2) Machine-readable specs

- OpenAPI (REST): https://opensource.tbank.ru/invest/invest-contracts/-/raw/master/src/docs/swagger-ui/openapi.yaml
- AsyncAPI (WebSocket): https://opensource.tbank.ru/invest/invest-contracts/-/raw/master/src/docs/ws/asyncapi.yaml
- gRPC proto contracts: https://opensource.tbank.ru/invest/invest-contracts/-/tree/master/src/docs/contracts
- Swagger UI mirror: https://russianinvestments.github.io/investAPI/swagger-ui/

As of verification date, OpenAPI/AsyncAPI version in contracts is `1.48`.

## 3) Endpoint summary

- gRPC production: `invest-public-api.tbank.ru:443`
- gRPC sandbox: `sandbox-invest-public-api.tbank.ru:443`
- REST production: `https://invest-public-api.tbank.ru/rest`
- REST sandbox: `https://sandbox-invest-public-api.tbank.ru/rest`
- WebSocket (documented): `wss://invest-public-api.tbank.ru/ws/`

## 4) Authentication and tokens

- Auth scheme is Bearer token.
- For REST, send header: `Authorization: Bearer <token>`.
- For gRPC/streams, token is passed in metadata.
- Token types include read-only, full-access, transfer-access, account-scoped, and sandbox token.
- Sandbox token is for sandbox methods only.
- Token lifetime: 3 months since last usage (from token docs).
- Error `40003` means missing/invalid/non-actual token.

## 5) Important compatibility note

Legacy OpenAPI v1 support is ended (stated as May 2023):  
https://developer.tbank.ru/invest/intro/developer/eol_v1

Use only current T-Invest API contracts and docs above.

## 6) Useful methods for this project

From current OpenAPI spec, key operation IDs for analytics and trading include:

- `UsersService_GetAccounts`
- `InstrumentsService_FindInstrument`
- `InstrumentsService_Shares`
- `MarketDataService_GetCandles`
- `MarketDataService_GetLastPrices`
- `MarketDataService_GetOrderBook`
- `OperationsService_GetPortfolio`
- `OrdersService_PostOrder`
- `OrdersService_CancelOrder`

## 7) Notes for MOEX index workflow

- MOEX indexes are usually analytics targets, not directly tradable instruments.
- In practice, strategy signals from indexes are usually mapped to tradable instruments (futures, ETFs/funds, stocks).
- Recommended integration path:
  1. Pull index/market data for signal generation.
  2. Resolve tradable instrument IDs (FIGI/UID) via Instruments methods.
  3. Get account(s) via `UsersService_GetAccounts`.
  4. Run in sandbox first (order placement/cancel flow).
  5. Move to production token after validation.

## 8) Selected limits worth implementing against

From the limits doc (verify before launch in case policy changes):

- Recommended aggregate traffic from one IP: up to `50 requests/sec`.
- Instruments service: `200` unary requests/min.
- Accounts service: `100` unary requests/min.
- Market data service: `600` unary requests/min.
- Orders service: `100` unary requests/min.
- `postOrder`: up to `15 requests/sec` (`900`/min) in listed limits.

Practical recommendation: add centralized throttling per service and separate stricter throttling for order placement.
