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
  const series = analytics.normalizeChartSeries([...observations, { ...observations[1], close: 999 }, { ...observations[1], asOf: "bad", close: 0 }, { ...observations[1], asOf: "2026-01-04", high: 100, low: 120 }]);
  assert.equal(series.length, 2);
  assert.equal(series[1].close, 110);
});

test("native chart range, candle aggregation, indicator warm-up and benchmark series are deterministic", () => {
  const points = Array.from({ length: 60 }, (_, index) => {
    const close = 100 + index;
    return { time: `2026-01-${String(index + 1).padStart(2, "0")}`, open: close - .5, high: close + 1, low: close - 1, close, volume: 100 + index };
  });
  // Use valid cross-month dates for the functions that compare timestamps.
  const dated = points.map((point, index) => ({ ...point, time: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10) }));
  assert.equal(analytics.selectChartRange(dated, "1W").length, 8);
  const weekly = analytics.aggregateChartInterval(dated, "1w");
  assert.equal(weekly.available, true);
  assert.ok(weekly.points.length < dated.length);
  assert.equal(analytics.aggregateChartInterval(dated, "5m").available, false);
  const technical = analytics.buildChartTechnicalSeries(dated);
  assert.equal(technical.sma20.length, 41);
  assert.equal(technical.sma20.at(-1).value, 149.5);
  assert.equal(technical.bollinger.length, 41);
  assert.equal(technical.rsi14.length, 46);
  assert.ok(technical.macd.some((item) => item.signal !== null));
  assert.equal(technical.availability["SMA 200"].available, false);
  const comparison = analytics.normalizeBenchmarkComparison(dated.slice(-5), dated.slice(-5).map((point) => ({ ...point, close: point.close * 2 })));
  assert.equal(comparison.available, true);
  assert.equal(comparison.points[0].primary, 100);
  assert.ok(Math.abs(comparison.points.at(-1).benchmark - (100 + 4 / 155 * 100)) < 0.0000001);
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

test("market dashboard derives cards, breadth, movers, 52-week eligibility, and sector coverage from compatible fixtures", () => {
  const dated = (symbol, exchange, values, volume = 100) => values.map(([asOf, close], index) => ({ symbol, exchange, asOf, close, high: close + 2, low: close - 2, volume: volume + index * 10, sourceUrl: "https://source.example/ohlcv", sourceClass: "verified_filing" }));
  const universe = [
    { instrumentId: "NSE:UP", symbol: "UP", exchange: "NSE", companyName: "Up Ltd", sector: "IT", marketCap: 900, observations: dated("UP", "NSE", [["2025-01-02", 80], ["2026-01-02", 100], ["2026-01-03", 110]], 300), fundamentals: [], evidenceCoveragePct: 60 },
    { instrumentId: "NSE:DOWN", symbol: "DOWN", exchange: "NSE", companyName: "Down Ltd", sector: "IT", marketCap: 100, observations: dated("DOWN", "NSE", [["2025-01-02", 150], ["2026-01-02", 130], ["2026-01-03", 120]], 100), fundamentals: [], evidenceCoveragePct: 60 },
    { instrumentId: "BSE:FLAT", symbol: "FLAT", exchange: "BSE", companyName: "Flat Ltd", sector: "Banking", observations: dated("FLAT", "BSE", [["2026-01-02", 50], ["2026-01-03", 50]], 200), fundamentals: [], evidenceCoveragePct: 30 },
    { instrumentId: "NSE:ONE", symbol: "ONE", exchange: "NSE", companyName: "One Row", sector: "IT", observations: dated("ONE", "NSE", [["2026-01-03", 50]]), fundamentals: [], evidenceCoveragePct: 0 },
  ];
  const overview = analytics.buildMarketOverview([
    { index: "NIFTY 50", asOf: "2026-01-02", value: 20_000, sourceUrl: "https://source.example/nifty", classification: "EOD" },
    { index: "NIFTY 50", asOf: "2026-01-03", value: 20_200, open: 20_050, high: 20_250, low: 20_000, sourceUrl: "https://source.example/nifty", classification: "EOD" },
  ], universe, { exchange: "NSE", session: "unknown" });
  assert.equal(overview.indexCards[0].previousClose, 20_000);
  assert.equal(overview.indexCards[0].change, 200);
  assert.equal(overview.indexCards[0].trend.length, 2);
  assert.deepEqual(overview.breadth, { scope: "NSE workspace", advancing: 1, declining: 1, unchanged: 0, eligibleComparisons: 2, unavailableComparisons: 1, validCloseRows: 3, coveragePct: 2 / 3 * 100, advanceDeclineRatio: 1 });
  assert.equal(overview.topGainers[0].symbol, "UP");
  assert.equal(overview.topLosers[0].symbol, "DOWN");
  assert.equal(overview.turnoverLeaders[0].symbol, "UP");
  assert.deepEqual(overview.fiftyTwoWeekHighs.map((row) => row.symbol), ["UP"]);
  assert.deepEqual(overview.fiftyTwoWeekLows.map((row) => row.symbol), ["DOWN"]);
  const sectors = analytics.aggregateSectorHeatmap(universe, { exchange: "NSE" });
  assert.equal(sectors.length, 1);
  assert.equal(sectors[0].sector, "IT");
  assert.equal(sectors[0].marketCapCoveragePct, 2 / 2 * 100);
  assert.equal(sectors[0].companies[0].symbol, "UP");
});

test("screener combines validated filters, preserves missing values, and sorts sourced rows", () => {
  const universe = [
    { instrumentId: "NSE:ALPHA", symbol: "ALPHA", exchange: "NSE", companyName: "Alpha Ltd", sector: "IT", marketCap: 1_000,
      observations: [...observations, { ...observations[1], asOf: "2026-01-04", close: 121, high: 123, low: 119, volume: 400 }],
      fundamentals: [{ ...fundamental, revenue: 100, netProfit: 10, eps: 1, asOf: "2025-01-03", fiscalPeriod: "FY25", pe: 12, pb: 2, roe: 15, roce: 17, debtToEquity: 0.4, dividendYield: 1 }, { ...fundamental, revenue: 130, netProfit: 15, eps: 1.5, asOf: "2026-01-03", fiscalPeriod: "FY26", pe: 10, pb: 1.8, roe: 20, roce: 22, debtToEquity: 0.3, dividendYield: 1.2 }], evidenceCoveragePct: 80 },
    { instrumentId: "BSE:BETA", symbol: "BETA", exchange: "BSE", companyName: "Beta Ltd", sector: "Banking", marketCap: 2_000,
      observations: [{ ...observations[0], symbol: "BETA", exchange: "BSE" }], fundamentals: [{ ...fundamental, symbol: "BETA", exchange: "BSE", pe: undefined, roe: undefined }], evidenceCoveragePct: 30 },
  ];
  const screened = analytics.screenInstruments(universe, { exchange: "NSE", minRoe: 18, maxPe: 11, minRevenueGrowthPct: 20, minEvidenceCoveragePct: 70, minVolume: 300 });
  assert.equal(screened.total, 1);
  assert.equal(screened.results[0].symbol, "ALPHA");
  assert.equal(analytics.screenInstruments(universe, { maxPe: 15 }).total, 1, "missing P/E must not satisfy a numeric ceiling");
  const sorted = analytics.sortScreenerRows(analytics.buildScreenerRows(universe), "marketCap", "desc");
  assert.deepEqual(sorted.map((row) => row.symbol), ["BETA", "ALPHA"]);
  const row = analytics.buildScreenerRows(universe)[0];
  assert.ok(Math.abs(row.revenueGrowthPct - 30) < 0.000001);
  assert.ok(row.volatilityPct !== null);
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

test("financial workspace keeps compatible bases separate and derives only valid statement metrics", () => {
  const base = { symbol: "TEST", exchange: "NSE", scope: "consolidated", periodType: "annual", periodEnd: "2026-03-31", publishedAt: "2026-05-01", currency: "INR", unit: "crores", actual: true, sourceUrl: "https://example.test/annual", sourceClass: "verified_filing" };
  const rows = [
    { ...base, statement: "income", values: { revenue: 1_000, ebitda: 200, operatingProfit: 150, netProfit: 100, eps: 10, financeCost: 25 } },
    { ...base, statement: "balance_sheet", values: { totalAssets: 2_000, totalEquity: 500, totalDebt: 150, currentAssets: 300, currentLiabilities: 150 } },
    { ...base, statement: "cash_flow", values: { operatingCashFlow: 180, capitalExpenditure: -60 } },
    { ...base, statement: "income", scope: "standalone", values: { revenue: 999 } },
  ];
  const workspace = analytics.buildFinancialWorkspace(rows, { scope: "consolidated", periodType: "annual" });
  const value = (key) => workspace.metrics.find((metric) => metric.key === key).value;
  assert.equal(workspace.statements.length, 3);
  assert.equal(value("ebitdaMargin"), 20);
  assert.equal(value("netMargin"), 10);
  assert.equal(value("debtToEquity"), .3);
  assert.equal(value("currentRatio"), 2);
  assert.equal(value("interestCoverage"), 6);
  assert.equal(value("freeCashFlow"), 120);
  assert.equal(analytics.buildFinancialWorkspace(rows, { scope: "standalone", periodType: "annual" }).statements.length, 1);
});

test("advanced financial metrics require compatible average balances and never invent enterprise-value components", () => {
  const base = { symbol: "ADV", exchange: "NSE", scope: "consolidated", periodType: "annual", currency: "INR", unit: "crores", actual: true, sourceUrl: "https://example.test/advanced", sourceClass: "verified_filing" };
  const rows = [
    { ...base, statement: "income", periodEnd: "2025-03-31", publishedAt: "2025-05-01", values: { revenue: 800, ebitda: 160, ebit: 120, netProfit: 80, eps: 8, profitBeforeTax: 100, taxExpense: 20 } },
    { ...base, statement: "balance_sheet", periodEnd: "2025-03-31", publishedAt: "2025-05-01", values: { totalAssets: 1_600, totalEquity: 400, totalDebt: 200, currentAssets: 300, currentLiabilities: 150, inventory: 60, cashAndCashEquivalents: 40 } },
    { ...base, statement: "cash_flow", periodEnd: "2025-03-31", publishedAt: "2025-05-01", values: { operatingCashFlow: 120, capitalExpenditure: -30 } },
    { ...base, statement: "income", periodEnd: "2026-03-31", publishedAt: "2026-05-01", values: { revenue: 1_000, ebitda: 220, ebit: 180, netProfit: 100, eps: 10, profitBeforeTax: 125, taxExpense: 25, marketPrice: 50, marketCapitalization: 1_000 } },
    { ...base, statement: "balance_sheet", periodEnd: "2026-03-31", publishedAt: "2026-05-01", values: { totalAssets: 2_000, totalEquity: 600, totalDebt: 300, currentAssets: 450, currentLiabilities: 180, inventory: 90, cashAndCashEquivalents: 70, restrictedCash: 10, preferredEquity: 0, nonControllingInterest: 0, sharesOutstanding: 100 } },
    { ...base, statement: "cash_flow", periodEnd: "2026-03-31", publishedAt: "2026-05-01", values: { operatingCashFlow: 180, capitalExpenditure: -60 } },
    { ...base, statement: "dividend", periodEnd: "2026-03-31", publishedAt: "2026-05-01", values: { dividendPerShare: 2 } },
  ];
  const calculated = analytics.calculateAdvancedFinancialMetrics(rows);
  const value = (key) => calculated.metrics.find((metric) => metric.key === key).value;
  assert.equal(value("roe"), 20, "ROE uses average, not closing, equity");
  assert.equal(value("roa"), 100 / 1800 * 100);
  assert.equal(value("roce"), 180 / ((1450 + 1820) / 2) * 100);
  assert.equal(value("roic"), 144 / (((200 + 400 - 40) + (300 + 600 - 60)) / 2) * 100);
  assert.equal(value("quickRatio"), 2);
  assert.equal(value("cashRatio"), 70 / 180);
  assert.equal(value("netDebt"), 240);
  assert.equal(value("enterpriseValue"), 1240);
  assert.equal(value("evEbitda"), 1240 / 220);
  assert.equal(value("dividendYield"), 4);
  assert.equal(value("dividendPayoutRatio"), 20);
  assert.equal(value("freeCashFlow"), 120);
  assert.equal(value("revenueGrowth"), 25);
  const withoutNci = rows.map((row) => row.periodEnd === "2026-03-31" && row.statement === "balance_sheet" ? { ...row, values: { ...row.values, nonControllingInterest: null } } : row);
  assert.equal(analytics.calculateAdvancedFinancialMetrics(withoutNci).metrics.find((metric) => metric.key === "enterpriseValue").value, null, "unknown EV components must not be silently treated as zero");
});

test("advanced financial metrics keep negative and incomplete denominators unavailable", () => {
  const base = { symbol: "EDGE", exchange: "BSE", scope: "standalone", periodType: "annual", periodEnd: "2026-03-31", publishedAt: "2026-05-01", currency: "INR", unit: "crores", actual: true, sourceUrl: "https://example.test/edge", sourceClass: "verified_filing" };
  const rows = [{ ...base, statement: "income", values: { revenue: 100, netProfit: -10, eps: -1, ebit: 5 } }, { ...base, statement: "balance_sheet", values: { totalAssets: 100, totalEquity: -5, currentAssets: 10, currentLiabilities: 0 } }];
  const calculated = analytics.calculateAdvancedFinancialMetrics(rows);
  const value = (key) => calculated.metrics.find((metric) => metric.key === key).value;
  assert.equal(value("roe"), null);
  assert.equal(value("pe"), null);
  assert.equal(value("currentRatio"), null);
  assert.equal(value("roce"), null, "a prior compatible balance is required");
});

test("financial unit normalization scales only explicit monetary units", () => {
  assert.equal(analytics.normalizeFinancialValue(1, "crores").value, 10_000_000);
  assert.equal(analytics.normalizeFinancialValue(100, "lakhs").value, 10_000_000);
  assert.equal(analytics.normalizeFinancialValue(1, "billions").value, 1_000_000_000);
  assert.equal(analytics.normalizeFinancialValue(12.5, "percent", "percentage").value, 12.5);
  assert.equal(analytics.normalizeFinancialValue(10, "per_share", "per_share").value, 10);
  assert.equal(analytics.normalizeFinancialValue(10, "percent").value, null);
  assert.equal(analytics.normalizeFinancialValue(10, null).value, null);
  assert.equal(analytics.normalizeFinancialValue(-5, "millions").value, -5_000_000);
});

test("TTM requires four discrete compatible consecutive quarters and excludes balance-sheet summation", () => {
  const base = { symbol: "TTM", exchange: "NSE", statement: "income", scope: "consolidated", periodType: "quarterly", currency: "INR", unit: "crores", actual: true, sourceUrl: "https://example.test/ttm", sourceClass: "verified_filing" };
  const quarters = [["2025-06-30", "2025-08-01", 1], ["2025-09-30", "2025-11-01", 2], ["2025-12-31", "2026-02-01", 3], ["2026-03-31", "2026-05-01", 4]].map(([periodEnd, publishedAt, revenue]) => ({ ...base, periodEnd, publishedAt, values: { revenue, netProfit: revenue } }));
  const ttm = analytics.buildTtmFinancials(quarters);
  assert.equal(ttm.available, true);
  assert.equal(ttm.values.revenue, 100_000_000);
  assert.equal(ttm.values.netProfit, 100_000_000);
  assert.equal(analytics.buildTtmFinancials([...quarters.slice(0, 3), { ...quarters[3], cumulative: true }]).available, false);
  assert.equal(analytics.buildTtmFinancials([...quarters.slice(0, 3), { ...quarters[3], periodEnd: "2026-09-30" }]).available, false);
  assert.equal(analytics.buildTtmFinancials([...quarters, { ...base, statement: "balance_sheet", periodEnd: "2026-03-31", publishedAt: "2026-05-01", values: { totalAssets: 500 } }]).values.totalAssets, undefined);
});

test("sector and shareholding engines keep applicability and overlapping categories explicit", () => {
  const base = { symbol: "BANK", exchange: "NSE", scope: "consolidated", periodType: "annual", periodEnd: "2026-03-31", publishedAt: "2026-05-01", currency: "INR", unit: "crores", actual: true, sourceUrl: "https://example.test/bank", sourceClass: "verified_filing" };
  const bank = analytics.calculateSectorSpecificMetrics([{ ...base, statement: "income", values: { interestIncome: 120, interestExpense: 60, operatingExpense: 20, operatingIncome: 100 } }, { ...base, statement: "balance_sheet", values: { earningAssets: 1_000, grossNpaPct: 2, netNpaPct: 1, capitalAdequacyRatio: 15, casaRatio: 40 } }], "Banking");
  assert.equal(bank.applicable, true);
  assert.equal(bank.metrics.find((metric) => metric.key === "nim").value, 6);
  assert.equal(analytics.calculateSectorSpecificMetrics([], "Information Technology").metrics[0].source, "not_applicable");
  const holding = { ...base, statement: "shareholding", periodType: "quarterly", values: { promoterHoldingPct: 50, fiiPct: 20, diiPct: 20, mutualFundsPct: 10, retailPct: 10 } };
  const reconciliation = analytics.reconcileShareholding([{ ...holding, periodEnd: "2025-12-31", publishedAt: "2026-02-01", values: { ...holding.values, promoterHoldingPct: 49 } }, holding]);
  assert.equal(reconciliation.status, "overlapping");
  assert.equal(reconciliation.categories.find((item) => item.category === "Promoter and promoter group").changePp, 1);
});

test("screener reuses statement-derived ratios and missing values cannot satisfy its filters", () => {
  const base = { symbol: "SCREEN", exchange: "NSE", scope: "consolidated", periodType: "annual", currency: "INR", unit: "crores", actual: true, sourceUrl: "https://example.test/screen", sourceClass: "verified_filing" };
  const statements = [
    { ...base, statement: "income", periodEnd: "2025-03-31", publishedAt: "2025-05-01", values: { revenue: 100, netProfit: 10, ebit: 20 } }, { ...base, statement: "balance_sheet", periodEnd: "2025-03-31", publishedAt: "2025-05-01", values: { totalAssets: 200, totalEquity: 100, currentAssets: 80, currentLiabilities: 40, inventory: 10 } },
    { ...base, statement: "income", periodEnd: "2026-03-31", publishedAt: "2026-05-01", values: { revenue: 120, netProfit: 15, ebit: 25 } }, { ...base, statement: "balance_sheet", periodEnd: "2026-03-31", publishedAt: "2026-05-01", values: { totalAssets: 240, totalEquity: 120, currentAssets: 100, currentLiabilities: 40, inventory: 10 } },
  ];
  const universe = [{ instrumentId: "NSE:SCREEN", symbol: "SCREEN", exchange: "NSE", companyName: "Screen Ltd", observations: [], fundamentals: [], financialStatements: statements, evidenceCoveragePct: 80 }];
  const row = analytics.buildScreenerRows(universe)[0];
  assert.equal(row.roe, 15 / 110 * 100);
  assert.equal(row.quickRatio, 2.25);
  assert.equal(analytics.screenInstruments(universe, { minRoe: 13, minQuickRatio: 2 }).total, 1);
  assert.equal(analytics.screenInstruments(universe, { minRoic: 1 }).total, 0);
});
