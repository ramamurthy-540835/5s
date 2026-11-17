# Stock Intelligence development status

## Implemented and fixture-tested

- Provider-neutral request execution: capability checks, caching, retries,
  timeout bounds, and circuit-breaker accounting.
- Search interaction, keyboard selection, deep-link selection, and canonical
  reference-instrument identity.
- Deterministic OHLCV transformation and technical indicators: SMA, EMA, RSI,
  MACD, Bollinger Bands, ATR, Stochastic, OBV, momentum, volatility, support,
  and resistance. Missing inputs produce `null`, never a fabricated value.
- Fundamental metric calculations where source values exist: margins, ROE,
  ROA, debt-to-equity, interest coverage, current ratio, and EV/EBITDA.
- Financial-statement normalization and trend extraction: canonical disclosure
  identity, restatement precedence, period/source metadata, invalid-value
  rejection, and no zero-filling of absent values.
- Market-overview aggregation, screener filtering, and sector heatmap
  aggregation over supplied source-attributed records.
- Risk semantics that distinguish data availability from investment risk;
  incomplete evidence results in `Not Assessable`.
- Responsive tabbed company workspace and compact empty states.
- Native SVG chart renderer with candlestick, line, area, volume, crosshair,
  responsive sizing, and full-screen behavior. It consumes only the normalized
  PRISM OHLCV contract.
- Administrator-only provider diagnostic endpoint at
  `/api/prism/stock-intelligence/provider`; it exposes status and capability
  health but never credential values.

## Implemented awaiting authorized data

- Market-index header, company dashboard, native chart data contract, screener,
  sector heatmap, rankings, financial-statement contract, scenarios, and
  evidence framework. They deliberately remain empty or unavailable until an
  approved adapter provides entitled records.

## Partially implemented

- Native chart infrastructure has candlestick, line, area, volume, crosshair,
  responsive sizing and full-screen controls. Provider-normalized OHLCV is
  connected to the price-chart tab. Indicator overlays and dedicated RSI/MACD
  panes remain pending: only the deterministic indicator cards are currently
  production-wired.
- Financial statements: normalized contract and ratio engine exist; statement
  ingestion adapter, statement tables, and visual trend components remain
  pending until an entitled source is selected.
- Provider administration: server-side administrator diagnostics and a safe
  test action exist; persistence, Secret Manager reference management, audit
  records, and an administrator UI remain pending.

## Blocked by external dependency

- Live or delayed NSE/BSE prices, index values, full instrument master,
  corporate actions, fundamentals, filings, news, and exchange-wide rankings.
  These require a signed provider agreement and credentials that expressly
  permit PRISM's intended display, storage, analytics, and end-user access.

## Data-handling policy

The TradingView embed remains an external display-only option. PRISM does not
read, store, transform, rank, or forecast from widget content. Test fixtures
are isolated in `tests/` and never enter production API responses.
