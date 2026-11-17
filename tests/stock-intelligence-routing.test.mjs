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
  assert.match(panel, /Technical Analysis/);
  assert.match(panel, /Future Scenarios/);
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
  assert.match(intelligenceRoute, /\["intelligence", "top5", "search"\]\.includes\(stockView/);
  assert.match(intelligenceRoute, /stockView === "top5"/);
  assert.match(intelligenceRoute, /rankIndiaStocks/);
  assert.match(intelligenceRoute, /owner_id=@userId/);
  assert.match(intelligenceRoute, /Cache-Control": "no-store"/);
  assert.match(intelligenceRoute, /buildStockIntelligence/);
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
  for (const expected of ["candles", "line", "area", "ResizeObserver", "Full screen", "onMouseMove", "volume"]) assert.match(nativeChart, new RegExp(expected));
  assert.doesNotMatch(nativeChart, /tradingview|widgetdata|fetch\s*\(/i);
});
