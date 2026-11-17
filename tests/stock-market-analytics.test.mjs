import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../backend/lib/stock-market-analytics.ts", import.meta.url), "utf8");
const analytics = {};
new Function("exports", "require", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(analytics, (name) => name === "./stock-intelligence" ? {} : (() => { throw new Error(`Unexpected dependency: ${name}`); })());

const observations = [
  { symbol: "TEST", exchange: "NSE", asOf: "2026-01-02", close: 100, high: 102, low: 98, volume: 100, sourceUrl: "https://example.test", sourceClass: "verified_filing" },
  { symbol: "TEST", exchange: "NSE", asOf: "2026-01-03", close: 110, high: 112, low: 108, volume: 250, sourceUrl: "https://example.test", sourceClass: "verified_filing" },
];
const fundamental = { symbol: "TEST", exchange: "NSE", asOf: "2026-01-03", fiscalPeriod: "FY26", revenue: 1_000, netProfit: 100, ebitda: 200, operatingProfit: 150, totalAssets: 2_000, totalEquity: 500, totalDebt: 100, currentAssets: 300, currentLiabilities: 150, interestExpense: 25, sourceUrl: "https://example.test", sourceClass: "verified_filing" };

test("chart normalization rejects duplicate and invalid candles", () => {
  const series = analytics.normalizeChartSeries([...observations, { ...observations[1], close: 999 }, { ...observations[1], asOf: "bad", close: 0 }]);
  assert.equal(series.length, 2);
  assert.equal(series[1].close, 110);
});

test("fundamental calculations retain unavailable denominators and calculate sourced ratios", () => {
  const metrics = analytics.calculateFundamentalMetrics(fundamental);
  assert.equal(metrics.available, true);
  assert.equal(metrics.netMarginPct, 10);
  assert.equal(metrics.currentRatio, 2);
  assert.equal(metrics.interestCoverage, 6);
  assert.equal(analytics.calculateFundamentalMetrics().available, false);
});

test("market overview, screener and sector heatmap use only supplied records", () => {
  const universe = [{ instrumentId: "NSE:TEST", symbol: "TEST", exchange: "NSE", companyName: "Test Corp", sector: "IT", marketCap: 1_000, observations, fundamentals: [fundamental], evidenceCoveragePct: 80 }];
  const overview = analytics.buildMarketOverview([{ index: "NIFTY 50", asOf: "2026-01-03", value: 20_100, previousClose: 20_000, sourceUrl: "https://example.test", classification: "EOD" }], universe);
  assert.equal(overview.indexCards[0].available, true);
  assert.equal(overview.indexCards[1].available, false);
  assert.equal(overview.topGainers[0].symbol, "TEST");
  assert.equal(analytics.screenInstruments(universe, { exchange: "NSE", minEvidenceCoveragePct: 50 }).total, 1);
  assert.equal(analytics.screenInstruments(universe, { exchange: "BSE" }).total, 0);
  assert.equal(analytics.aggregateSectorHeatmap(universe)[0].sector, "IT");
});

test("financial statement normalization de-duplicates disclosures and never zero-fills missing values", () => {
  const statements = [
    { symbol: "TEST", exchange: "NSE", statement: "income", scope: "consolidated", periodType: "annual", periodEnd: "2025-03-31", publishedAt: "2025-05-01", currency: "INR", unit: "crores", actual: true, values: { revenue: 100, netProfit: null }, sourceUrl: "https://example.test/results", sourceClass: "verified_filing" },
    { symbol: "TEST", exchange: "NSE", statement: "income", scope: "consolidated", periodType: "annual", periodEnd: "2025-03-31", publishedAt: "2025-05-02", currency: "INR", unit: "crores", actual: true, restated: true, values: { revenue: 110, netProfit: NaN }, sourceUrl: "https://example.test/results", sourceClass: "verified_filing" },
    { symbol: "TEST", exchange: "NSE", statement: "income", scope: "consolidated", periodType: "annual", periodEnd: "invalid", publishedAt: "2025-05-02", currency: "INR", unit: "crores", actual: true, values: { revenue: 999 }, sourceUrl: "https://example.test/invalid", sourceClass: "verified_filing" },
  ];
  const normalized = analytics.normalizeFinancialStatements(statements);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].values.revenue, 110);
  assert.equal(normalized[0].values.netProfit, null);
  const trend = analytics.buildFinancialTrend(statements, "revenue", { statement: "income", scope: "consolidated", periodType: "annual" });
  assert.deepEqual(trend.map((point) => point.value), [110]);
  assert.equal(analytics.buildFinancialTrend(statements, "netProfit").length, 0);
});
