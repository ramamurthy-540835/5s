import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const canonical = fs.readFileSync(new URL("../frontend/app/admin/prism/stock-intelligence/page.tsx", import.meta.url), "utf8");
const legacy = fs.readFileSync(new URL("../frontend/app/admin/prism/stock-exchange/page.tsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../frontend/components/workbench/AppSidebar.tsx", import.meta.url), "utf8");
const intelligenceRoute = fs.readFileSync(new URL("../frontend/app/api/prism/apps/[app]/route.ts", import.meta.url), "utf8");
const nextConfig = fs.readFileSync(new URL("../next.config.js", import.meta.url), "utf8");

test("Stock Intelligence has a canonical workspace route and Cloud Run-safe internal rewrite", () => {
  assert.match(canonical, /DomainWorkspace app="stock-exchange"/);
  assert.match(legacy, /DomainWorkspace app="stock-exchange"/);
  assert.match(nextConfig, /source: "\/admin\/prism\/stock-intelligence"/);
  assert.match(nextConfig, /destination: "\/admin\/prism\/stock-exchange"/);
  assert.match(sidebar, /label: "Stock Intelligence"/);
  assert.match(sidebar, /href: "\/admin\/prism\/stock-intelligence"/);
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
