import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../backend/lib/stock-intelligence.ts", import.meta.url), "utf8");
const intelligence = {};
new Function("exports", "require", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(intelligence, () => { throw new Error("Unexpected dependency"); });

const observations = Array.from({ length: 70 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
  return { symbol: "DEMO", exchange: "NSE", asOf: date, close: 100 + index, volume: 1_000 + (index > 64 ? 2_000 : 0), niftyClose: 20_000 + index * .4, sectorClose: 1_000 + index * .2, fiiNetFlow: index % 2 ? 100 : -100, sourceUrl: "https://example.test/market", sourceClass: "verified_filing" };
});

test("multi-timeframe aggregation calculates price, relative strength and volume without future rows", () => {
  const windows = intelligence.aggregateTimeframes(observations);
  assert.deepEqual(windows.map((item) => item.timeframe), ["3Y", "1Y", "6M", "3M", "1M", "1W", "1D"]);
  const oneMonth = windows.find((item) => item.timeframe === "1M");
  assert.equal(oneMonth.available, true);
  assert.ok(oneMonth.price.changePct > 0);
  assert.equal(oneMonth.volume.abnormal, true);
  assert.ok(oneMonth.relativeStrength.nifty50Pct > 0);
});

test("illustrative scenarios suppress uncalibrated probabilities while the probability helper remains deterministic", () => {
  const scenarios = intelligence.generateScenarios(observations);
  const threeMonths = scenarios.find((item) => item.horizon === "3M");
  assert.equal(threeMonths.available, true);
  assert.equal(threeMonths.scenarios.length, 4);
  assert.equal(threeMonths.calibrated, false);
  assert.ok(threeMonths.scenarios.every((item) => item.probability === null && item.confidence === null));
  assert.equal(threeMonths.probabilityWeightedReturnPct, null);
  assert.equal(intelligence.probabilityWeightedReturn([{ probability: 2, expectedReturnPct: 10 }, { probability: 2, expectedReturnPct: -2 }]), 4);
});

test("insufficient history produces no invented forecast", () => {
  const scenario = intelligence.generateScenarios(observations.slice(0, 10));
  assert.ok(scenario.every((item) => item.available === false && item.scenarios.length === 0));
});

test("factor report retains source URLs and flags missing fundamentals as a limitation", () => {
  const report = intelligence.buildStockIntelligence({ symbol: "DEMO", exchange: "NSE", observations, fundamentals: [], research: [] });
  assert.equal(report.factors.length, 12);
  assert.ok(report.sources.includes("https://example.test/market"));
  assert.ok(report.explainability.limitations.some((item) => item.includes("No sourced fundamentals")));
  assert.equal(report.factors.find((item) => item.id === "fundamentals").normalizedScore, null);
  assert.ok(report.explainability.evidenceCoveragePct < 100);
  assert.equal(report.explainability.weightRedistributed, true);
});

test("point-in-time backtest only uses observations at or before each as-of date", () => {
  const result = intelligence.pointInTimeBacktest(observations, 5);
  assert.ok(result.observations > 0);
  assert.ok(result.hitRate >= 0 && result.hitRate <= 1);
});

test("Top 5 ranking excludes stale, conflicting and insufficient candidates by default", () => {
  const fundamental = { symbol: "DEMO", exchange: "NSE", asOf: "2026-01-31", fiscalPeriod: "Q3 FY26", revenue: 1_000, netProfit: 150, roe: 18, roce: 20, ebitdaMargin: 18, debtToEquity: .2, pe: 18, sourceUrl: "https://example.test/results", sourceClass: "verified_filing" };
  const eligible = { symbol: "DEMO", exchange: "NSE", observations, fundamentals: [fundamental], research: [], liquidityScore: .9 };
  const stale = { symbol: "STALE", exchange: "NSE", observations: observations.map((row) => ({ ...row, symbol: "STALE", asOf: "2025-01-01" })), fundamentals: [{ ...fundamental, symbol: "STALE" }], research: [], liquidityScore: .9 };
  const ranked = intelligence.rankIndiaStocks([eligible, stale], "balanced", { now: new Date("2026-02-03T00:00:00Z") });
  assert.equal(ranked.selected.length, 1);
  assert.equal(ranked.selected[0].symbol, "DEMO");
  assert.equal(ranked.excluded[0].symbol, "STALE");
});

test("data quality detects duplicate observation dates and conflicting research", () => {
  const quality = intelligence.validateStockData({ symbol: "DEMO", exchange: "NSE", observations: [...observations.slice(0, 30), observations[0]], fundamentals: [{ symbol: "DEMO", exchange: "NSE", asOf: "2026-01-31", fiscalPeriod: "Q3", sourceUrl: "https://example.test/results", sourceClass: "verified_filing" }], research: [{ symbol: "DEMO", exchange: "NSE", publishedAt: "2026-01-31", title: "Unverified item", summary: "", sourceUrl: "https://example.test/news", sourceClass: "rumor", materiality: "high", conflicted: true }] }, new Date("2026-02-03T00:00:00Z"));
  assert.equal(quality.eligible, false);
  assert.equal(quality.duplicateDates, 1);
  assert.equal(quality.conflictingSources, 1);
});
