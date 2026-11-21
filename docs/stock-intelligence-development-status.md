# Stock Intelligence development status

## Adjacent PRISM module: 5S Industrial AI (implementation checkpoint)

- Added the tenant-scoped 5S Industrial AI route and workspace at `/admin/prism/industrial-5s`, with two separate upload areas, company/template selection, human verification controls, image-timeline review, validation summary, deterministic export workflow, and protected download flow.
- Added versioned contracts and three real logical-agent boundaries: Industrial Document Intelligence (source/provenance extraction contract), Company Template Intelligence (published template mapping), and Industrial Excel and Image Intelligence (timestamp policy, chronology, and XLSX generation).
- Private Cloud Storage upload/export functions are implemented but intentionally remain unavailable until `PRISM_5S_DOCUMENTS_BUCKET` is configured as a private bucket. Document AI and Vertex AI extraction are deliberately blocked rather than fabricated until approved processor/model configuration exists.
- The in-repository XLSX renderer creates the required `Inspection Report` and `Machinery Images` sheets in order and embeds supplied machinery images. It accepts only a verified snapshot; missing mandatory CNC fields and unresolved timestamp conflicts block export.

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
- Financial statement ingestion contract and authenticated Financials workspace:
  validated annual, quarterly, TTM, consolidated, standalone, restated income,
  balance-sheet, cash-flow, and shareholding records; source-linked statement
  tables; reporting-basis controls; derived margin, leverage, liquidity,
  interest-coverage and free-cash-flow metrics; and source-only revenue,
  profit, EPS, debt and operating-cash-flow trend charts.
- Tenant-scoped `fundamentals`, `financial-statements`, `financial-trends`, and
  `shareholding` API views. These use compatible reporting basis and period
  filters, preserve original currency/unit metadata, and return unavailable
  metrics rather than zero-filled financial facts.
- Market-overview aggregation, sector heatmap aggregation, and a complete
  source-only screener calculation path over supplied observations. The
  screener supports exchange, company/ticker, sector, industry, market-cap,
  P/E, P/B, ROE, ROCE, debt/equity, dividend yield, revenue/profit/EPS growth,
  volume, momentum, volatility and evidence-coverage filters; it validates
  numeric ranges and applies stable server-side sorting and bounded pagination.
- Authenticated, tenant-scoped `market-overview` and `screener` API views
  that bind those calculations to real workspace records; they return no
  exchange data when the user has no authorized observations.
- Risk semantics that distinguish data availability from investment risk;
  incomplete evidence results in `Not Assessable`.
- Responsive tabbed company workspace and compact empty states.
- Dedicated authenticated Stock Screener workspace at
  `/admin/prism/stock-exchange/screener`, linked from Market Overview. It has
  debounced search, request cancellation, responsive filter controls, documented
  no-threshold presets, API error/loading/empty states, source-only result
  columns, reset/apply controls and bounded pagination. Reference-catalogue
  identifiers are explicitly not financial evidence.
- The screener route places its `useSearchParams` client consumer beneath a
  route-level React `Suspense` boundary with an accessible dashboard skeleton,
  preserving sector drill-down query parameters during Next.js prerendering.
- Dedicated authenticated Market Overview dashboard at
  `/admin/prism/stock-exchange/market-overview`. It includes sourced-only
  index cards with mini trends and provenance, manual refresh/request
  cancellation, NSE/BSE workspace filters, breadth distribution, movers,
  activity/turnover lists, calendar-based 52-week eligibility, sector heatmap
  drill-down into the screener, sector-performance table, source-aware empty
  states and direct company navigation.
- Market dashboard calculations: compatible close-to-close changes, stable
  gainers/losers/activity tie-breaking, turnover only when both price and
  volume are sourced, market-cap/equal-weighted sector returns, explicit
  market-cap coverage, and unavailable-comparison counts. Missing price,
  session, capitalization, or index observations remain unavailable rather
  than becoming zero or an inferred value.
- Six-section company navigation (Overview, Charts & Technicals, Financials,
  Valuation, AI Intelligence, News & Risk), avoiding the former clipped
  eleven-button horizontal tab row.
- Native SVG chart workspace with candlestick, OHLC, line, and area modes;
  volume histograms; crosshair OHLCV tooltips; pointer/touch panning;
  wheel zoom; keyboard pan; reset, log-scale, responsive, and full-screen
  controls. It consumes only the authenticated normalized PRISM OHLCV contract.
- Authenticated `view=chart` API contract with bounded display ranges,
  validated intervals, provider capability disclosure, raw-price adjustment
  basis, source references, range coverage, benchmark normalization, and no-cache
  handling. It never derives intraday candles from daily observations.
- Timestamp-aligned chart-series calculations for SMA 20/50/100/200, EMA
  12/26/50/200, Bollinger Bands, RSI 14, and MACD/signal/histogram. The chart
  exposes indicator warm-up limits and does not fill missing market sessions.
- Administrator-only provider diagnostic endpoint at
  `/api/prism/stock-intelligence/provider`; it exposes status and capability
  health but never credential values.

## Implemented awaiting authorized data

- Live exchange-wide market session calendar, SENSEX/NIFTY BANK index ingestion,
  company dashboard, native chart data contract, screener result population,
  sector heatmap, rankings, financial-statement contract, scenarios, and
  evidence framework. They deliberately remain empty or unavailable until an
  approved adapter provides entitled records.

## Phase 4B — advanced financial analytics (fixture-tested)

- A single deterministic financial engine now derives return, liquidity,
  solvency, valuation, growth, cash-flow and dividend metrics from normalized,
  compatible statements. It requires average current/prior balances for ROE,
  ROA, ROCE, financial leverage and ROIC; it never substitutes a closing
  balance when the prior balance is missing.
- Current ratio, quick ratio, cash ratio, debt/assets, net debt,
  net-debt/EBITDA, working capital, gross/EBITDA/operating/net margins,
  revenue-through-free-cash-flow growth, and three/five-year revenue CAGR use
  explicit formulas and return `null` when a denominator, comparable period or
  positive CAGR start value is not available.
- Enterprise value is deliberately strict: market capitalization,
  interest-bearing debt, preferred equity, non-controlling interest and
  eligible cash must all be sourced. Missing EV components are not treated as
  zero. Conventional P/E, EV/EBITDA and related multiples are unavailable for
  negative or unsuitable denominators.
- Provider-neutral `dividend` disclosures are accepted alongside income,
  balance-sheet, cash-flow and shareholding records. Dividend per share, yield,
  payout ratio, growth and a source-only trend are rendered when compatible
  records and market-price inputs exist. An absent disclosure is never read as
  a zero dividend.
- The Financials workspace now displays expanded derived KPI cards plus EBITDA,
  free-cash-flow and dividend source-only trends. All values continue to carry
  their reporting period, publication date, original unit, source URL and
  reported/derived classification.

### Phase 4B source fields still required for live completeness

Approved financial sources must provide compatible current and prior balance
sheets, income statements, cash-flow statements, market price/capitalization,
share count, preferred equity, non-controlling interest, eligible/restricted
cash, dividend corporate actions, and issuer ownership taxonomy. Sector-specific
bank/NBFC/insurance metrics, TTM construction from distinct non-cumulative
quarters, company profile/segment records, unit conversion across incompatible
source units, and direct screener materialization from normalized statements
remain incomplete pending those contracts and a provider-approved ingestion
workflow.

## Phase 4C — financial-engine consolidation (fixture-tested)

- The common financial-unit normalizer recognizes absolute values, thousands,
  lakhs, millions, crores, billions and trillions, converting only explicit
  monetary values into absolute source-currency units. Percentages, share
  counts and per-share values retain their scale; unknown/incompatible units
  are rejected instead of guessed. Currency conversion is intentionally not
  attempted without an entitled FX source.
- TTM construction now accepts only four distinct, discrete, consecutive,
  same-currency quarterly disclosures that were published by the requested
  as-of date. It excludes cumulative disclosures, restated duplicates and
  balance-sheet stock values from flow aggregation. Missing periods and mixed
  currencies produce an unavailable result rather than a partial TTM.
- The financial workspace response exposes TTM methodology and shareholding
  reconciliation status. Shareholding reconciliation preserves parent and
  subcategory taxonomy, detects DII/mutual-fund/insurance overlap, calculates
  compatible percentage-point movement, applies a documented 0.5-point
  rounding tolerance, and never forces disclosures to 100%.
- Sector-aware calculations gate banking/NBFC/insurance metrics from
  industrial-company ratios. NIM and cost-to-income are derived only from
  compatible inputs; regulated ratios such as NPA, capital adequacy, CASA,
  solvency, claim and combined ratios remain reported-only unless a permitted
  source defines all inputs.
- The screener now receives tenant-scoped normalized financial-statement rows
  in its existing bounded batch and reuses the same deterministic metric engine
  for ROA, ROIC, current ratio, quick ratio and free-cash-flow yield. A missing
  statement metric cannot satisfy a numeric filter.

### Phase 4C remaining external/data dependencies

The source contract still needs an approved financial provider or permitted
issuer/exchange disclosure adapter with field-level units, explicit discrete
versus cumulative quarterly classification, share count and market-price
timing, company sector taxonomy, dividend ex/record/payment dates, full
shareholding taxonomy, and regulated financial-institution disclosures.
Provider data is also required before live TTM, screener, ranking, browser and
end-to-end financial research verification can be claimed.

## Partially implemented

- Native chart uses an in-repository SVG renderer and therefore adds no charting
  dependency or third-party charting licence obligation. It is fixture-tested;
  browser interaction validation and an authorized-data review remain pending.
- Coarse daily source data can be aggregated to weekly/monthly candles. Native
  intraday candle rendering remains awaiting an entitled intraday provider;
  unsupported intervals are disabled and never synthesized.
- Corporate-action metadata is represented in the chart contract, but adjusted
  and total-return plotting remain awaiting entitled action data and published
  adjustment factors.
- Financial-statement provider adapters and live permitted-document ingestion
  remain pending an approved financial-data or issuer-disclosure source. The
  workspace and validated record-ingestion boundary are fixture-tested only.
- Provider administration: server-side administrator diagnostics and a safe
  test action exist; persistence, Secret Manager reference management, audit
  records, and an administrator UI remain pending.
- Market overview presentation now reserves explicit source-dependent states
  for breadth, movers, activity, 52-week ranges, and sector heatmap. Its
  exchange-wide provider ingestion and interactive drill-down remain pending.

## Blocked by external dependency

- Live or delayed NSE/BSE prices, index values, full instrument master,
  corporate actions, fundamentals, filings, news, and exchange-wide rankings.
  These require a signed provider agreement and credentials that expressly
  permit PRISM's intended display, storage, analytics, and end-user access.

## Data-handling policy

The TradingView embed remains an external display-only option. PRISM does not
read, store, transform, rank, or forecast from widget content. Test fixtures
are isolated in `tests/` and never enter production API responses.
