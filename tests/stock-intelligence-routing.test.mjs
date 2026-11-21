import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const canonical = fs.readFileSync(new URL("../frontend/app/admin/prism/stock-intelligence/page.tsx", import.meta.url), "utf8");
const legacy = fs.readFileSync(new URL("../frontend/app/admin/prism/stock-exchange/page.tsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../frontend/components/workbench/AppSidebar.tsx", import.meta.url), "utf8");
const intelligenceRoute = fs.readFileSync(new URL("../frontend/app/api/prism/apps/[app]/route.ts", import.meta.url), "utf8");
const nextConfig = fs.readFileSync(new URL("../next.config.js", import.meta.url), "utf8");

test("Stock Intelligence has a canonical workspace route and Cloud Run-safe internal rewrite", () => {
  assert.match(canonical, /StockIntelligenceWorkspace/);
  assert.match(legacy, /StockIntelligenceWorkspace/);
  assert.match(nextConfig, /source: "\/admin\/prism\/stock-intelligence"/);
  assert.match(nextConfig, /destination: "\/admin\/prism\/stock-exchange"/);
  assert.match(sidebar, /label: "Stock Intelligence"/);
  assert.match(sidebar, /href: "\/admin\/prism\/stock-intelligence"/);
});

test("Stock Intelligence does not render manual records or paper trading", () => {
  const workspace = fs.readFileSync(new URL("../frontend/components/apps/StockIntelligenceWorkspace.tsx", import.meta.url), "utf8");
  const panel = fs.readFileSync(new URL("../frontend/components/apps/StockIntelligencePanel.tsx", import.meta.url), "utf8");
  const stockPage = `${workspace}\n${panel}`;
  for (const label of ["Manual research, saved records & paper trading", "Paper portfolio simulation", "Filter records", "No paper positions yet.", "No records yet."]) {
    assert.doesNotMatch(stockPage, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(panel, /rankPanel\("NSE", nse\)/);
  assert.match(panel, /rankPanel\("BSE", bse\)/);
  assert.match(panel, /PublicMarketWidget/);
  assert.match(panel, /Charts & Technicals/);
  assert.match(panel, /Financials/);
  assert.match(panel, /AI Intelligence/);
  assert.match(panel, /grid-cols-2 gap-2 border-b/);
  assert.match(panel, /Market data status/);
});

test("company dashboard has one data status panel and uses not-assessable risk wording", () => {
  const panel = fs.readFileSync(new URL("../frontend/components/apps/StockIntelligencePanel.tsx", import.meta.url), "utf8");
  assert.equal((panel.match(/aria-label="Market data status"/g) || []).length, 1);
  assert.match(panel, /Not Assessable/);
  assert.match(panel, /Company research sections/);
  assert.doesNotMatch(panel, /Paper portfolio simulation/);
});

test("demo public market widget is display-only", () => {
  const widget = fs.readFileSync(new URL("../frontend/components/apps/PublicMarketWidget.tsx", import.meta.url), "utf8");
  assert.match(widget, /s3\.tradingview\.com\/external-embedding/);
  assert.match(widget, /PRISM does not store, redistribute, rank, or forecast/);
  assert.doesNotMatch(widget, /fetch\(/);
});

test("Stock Intelligence API remains authenticated, tenant-scoped and non-cacheable", () => {
  assert.match(intelligenceRoute, /"intelligence", "chart", "top5", "search", "market-overview", "screener"/);
  assert.match(intelligenceRoute, /stockView === "top5"/);
  assert.match(intelligenceRoute, /rankIndiaStocks/);
  assert.match(intelligenceRoute, /owner_id=@userId/);
  assert.match(intelligenceRoute, /Cache-Control": "no-store"/);
  assert.match(intelligenceRoute, /buildStockIntelligence/);
  assert.match(intelligenceRoute, /const overview = buildMarketOverview\(indices, instruments, \{ exchange:/);
  assert.match(intelligenceRoute, /aggregateSectorHeatmap\(instruments, \{ exchange:/);
  assert.match(intelligenceRoute, /screenInstruments\(instruments, filters\)/);
  assert.match(intelligenceRoute, /sortScreenerRows/);
  assert.match(intelligenceRoute, /Numeric screener filters are invalid/);
  assert.match(intelligenceRoute, /stockView === "chart"/);
  assert.match(intelligenceRoute, /aggregateChartInterval/);
  assert.match(intelligenceRoute, /buildChartTechnicalSeries/);
  assert.match(intelligenceRoute, /Unsupported candle interval/);
});

test("Stock Screener has a dedicated authenticated workspace linked from Market Overview", () => {
  const workspace = fs.readFileSync(new URL("../frontend/components/apps/StockIntelligenceWorkspace.tsx", import.meta.url), "utf8");
  const screener = fs.readFileSync(new URL("../frontend/components/apps/StockScreenerWorkspace.tsx", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../frontend/app/admin/prism/stock-exchange/screener/page.tsx", import.meta.url), "utf8");
  assert.match(workspace, /Open Stock Screener/);
  assert.match(screener, /view=screener/);
  assert.match(screener, /AbortController/);
  assert.match(screener, /Apply filters/);
  assert.match(screener, /No eligible sourced results/);
  assert.match(screener, /catalogue entries are not treated as financial evidence/i);
  assert.match(page, /StockScreenerWorkspace/);
  assert.match(page, /Suspense/);
  assert.match(page, /ScreenerLoadingFallback/);
  assert.match(page, /Loading Stock Screener/);
});

test("Market Overview dashboard binds authenticated cards, breadth, movers and sector drill-down", () => {
  const dashboard = fs.readFileSync(new URL("../frontend/components/apps/MarketOverviewDashboard.tsx", import.meta.url), "utf8");
  const page = fs.readFileSync(new URL("../frontend/app/admin/prism/stock-exchange/market-overview/page.tsx", import.meta.url), "utf8");
  const workspace = fs.readFileSync(new URL("../frontend/components/apps/StockIntelligenceWorkspace.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /view=market-overview/);
  assert.match(dashboard, /AbortController/);
  assert.match(dashboard, /Market breadth/);
  assert.match(dashboard, /Top gainers/);
  assert.match(dashboard, /Sector heatmap/);
  assert.match(dashboard, /stock-exchange\/screener\?sector=/);
  assert.match(page, /MarketOverviewDashboard/);
  assert.match(workspace, /Market Dashboard/);
});

test("search-first V3 API enforces its minimum query and keeps exchange rankings separate", () => {
  assert.match(intelligenceRoute, /"search"/);
  assert.match(intelligenceRoute, /query\.length < 3/);
  assert.match(intelligenceRoute, /minimumQueryLength: 3/);
  assert.match(intelligenceRoute, /exchange: exchange \|\| null/);
  assert.match(intelligenceRoute, /top-gainers/);
  assert.match(intelligenceRoute, /authorized market-data provider/);
});

test("provider diagnostics are administrator-only and do not serialize credentials", () => {
  const route = fs.readFileSync(new URL("../frontend/app/api/prism/stock-intelligence/provider/route.ts", import.meta.url), "utf8");
  assert.match(route, /user\.role !== "admin"/);
  assert.match(route, /secretReferenceConfigured/);
  assert.match(route, /body\.action !== "test"/);
  assert.doesNotMatch(route, /MARKET_DATA_API_KEY:\s*process\.env/);
});

test("native price chart is source-contract-only and supplies interactive market controls", () => {
  const nativeChart = fs.readFileSync(new URL("../frontend/components/apps/NativePriceChart.tsx", import.meta.url), "utf8");
  for (const expected of ["candles", "ohlc", "line", "area", "ResizeObserver", "Full screen", "onMouseMove", "onWheel", "volume", "RSI \\(14\\)", "MACD \\(12, 26, 9\\)", "bollinger", "AbortController", "benchmark"]) assert.match(nativeChart, new RegExp(expected));
  assert.match(nativeChart, /view: "chart"/);
  assert.match(nativeChart, /api\/prism\/apps\/stock-exchange/);
  assert.doesNotMatch(nativeChart, /tradingview|widgetdata/i);
});

test("financial workspace binds authenticated statement records, reporting controls and source-linked trends", () => {
  const financial = fs.readFileSync(new URL("../frontend/components/apps/FinancialResearchWorkspace.tsx", import.meta.url), "utf8");
  const panel = fs.readFileSync(new URL("../frontend/components/apps/StockIntelligencePanel.tsx", import.meta.url), "utf8");
  assert.match(financial, /view: "financial-statements"/);
  assert.match(financial, /AbortController/);
  assert.match(financial, /Consolidated/);
  assert.match(financial, /Standalone/);
  assert.match(financial, /Annual/);
  assert.match(financial, /Quarterly/);
  assert.match(financial, /Profitability|Fundamentals and financial statements/);
  assert.match(financial, /TrendChart/);
  assert.match(panel, /FinancialResearchWorkspace/);
  assert.match(intelligenceRoute, /"financial-statements"/);
  assert.match(intelligenceRoute, /buildFinancialWorkspace/);
  assert.match(intelligenceRoute, /financial-statement/);
});
