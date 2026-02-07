# MOEX ISS Concepts (Quick Guide)

This is a pragmatic guide to the MOEX ISS API for developers working on this
repo. It complements the official reference by explaining how the API behaves,
how responses are structured, and how to navigate the most common endpoints.

## What ISS Is

ISS (Information and Statistical Server) is MOEX's HTTP API. It exposes market
data in a consistent, table-oriented JSON format. Most endpoints return one or
more "tables" with `columns` and `data`.

## Response Shape

Most endpoints return one or more named tables:

```json
{
  "securities": {
    "columns": ["SECID", "SHORTNAME", "NAME"],
    "data": [["IMOEX", "Индекс МосБиржи", "Индекс МосБиржи"]]
  }
}
```

You should map rows to objects by zipping `columns` with each row in `data`.

## Common Query Parameters

- `iss.meta=off` disables metadata blocks (smaller responses).
- `lang=ru` or `lang=en` changes response language.
- `limit` and `start` control pagination for many endpoints.
- `<table>.columns=...` narrows the fields returned for a table.

Example:

```url
.../securities.json?iss.meta=off&lang=ru&securities.columns=SECID,SHORTNAME,NAME
```

## Pagination (Cursor)

Many endpoints paginate. The response includes a cursor table, for example
`history.cursor` with:

- `INDEX` (current offset)
- `TOTAL` (total rows)
- `PAGESIZE` (page size)

To fetch all rows, keep requesting with `start += PAGESIZE` until `start >= TOTAL`.



## Key Endpoint Families

### 1) Securities (Lists)

Lists instruments for a given engine/market:

```
/iss/engines/<engine>/markets/<market>/securities.json
```

For MOEX indexes:

```
/iss/engines/stock/markets/index/securities.json
```

### 2) History (Daily Time Series)

Historical daily values for a single security:

```
/iss/history/engines/<engine>/markets/<market>/securities/<SECID>.json
```

Use `from` and `till` to bound the date range. The most common fields:

- `TRADEDATE`, `OPEN`, `HIGH`, `LOW`, `CLOSE`

### 3) Candles (OHLC per Interval)

For intraday or custom intervals:

```
/iss/engines/<engine>/markets/<market>/securities/<SECID>/candles.json
```

Use `interval` to choose a timeframe (for example, 1, 10, 60, 24, etc. depending
on what the market supports). Candles are often best for charting.

## Practical Notes

- Data can be sparse (weekends/holidays). Always sort by `TRADEDATE`.
- Some instruments have missing values for specific fields.
- Use `iss.meta=off` unless you explicitly need metadata.
- Use `*.columns=...` to keep payloads small and faster.

## Where This Repo Uses ISS

- `web/src/lib/moex-client.ts` implements a small axios client that:
  - Lists MOEX indexes.
  - Fetches historical series and paginates using the cursor table.
- `web/src/app/moex-indexes/page.tsx` visualizes the series in a line chart.

## Troubleshooting

- If data looks incomplete, confirm pagination (cursor table).
- If the last date is older than expected, check trading calendar and holidays.
- If the browser blocks requests, set `NEXT_PUBLIC_MOEX_BASE_URL` to a proxy.
