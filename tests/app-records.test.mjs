import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../backend/lib/app-records.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const records = {};
new Function("exports", "require", compiled)(records, () => { throw new Error("Unexpected import"); });

test("export case preserves origin for route review", () => {
  const result = records.parseAppRecord("textile-exports", "shipment", { product: "Cotton shirts", origin: "India", destination: "UAE", route: "India → UAE → US" });
  assert.equal(result.payload.origin, "India");
  assert.equal(result.payload.route, "India → UAE → US");
});

test("route comparison computes landed estimate from entered assumptions", () => {
  const result = records.parseAppRecord("textile-exports", "route-option", { shipmentId: "case-1", market: "UAE", goodsValue: 1000, freight: 100, otherCosts: 25, dutyRate: 5, transitDays: 7 });
  assert.equal(result.payload.landedEstimate, 1175);
  assert.throws(() => records.parseAppRecord("textile-exports", "route-option", { shipmentId: "case-1", market: "UAE", goodsValue: 1000, dutyRate: 150 }));
});

test("auction listing requires positive reserve, valuation and a future close", () => {
  assert.throws(() => records.parseAppRecord("property-auctions", "listing", { address: "1 Main St", seller: "A", reservePrice: -1, valuation: 100, closesOn: "2099-01-01" }));
  assert.throws(() => records.parseAppRecord("property-auctions", "listing", { address: "1 Main St", seller: "A", reservePrice: 100, valuation: 100, closesOn: "2020-01-01" }));
});

test("auction calculations are display-only values derived from seller input", () => {
  const listing = records.parseAppRecord("property-auctions", "listing", { address: "1 Main St", seller: "A", reservePrice: 1_500_000, valuation: 2_000_000, closesOn: "2099-01-01" });
  const bid = records.parseAppRecord("property-auctions", "bid", { listingId: "listing-id", bidAmount: 200_000 });
  assert.equal(listing.payload.listingFee, 5_000);
  assert.deepEqual(listing.payload.documents, []);
  assert.equal(bid.payload.depositPreview, 50_000);
});

test("paper trades reject fractional shares and invalid sides", () => {
  assert.throws(() => records.parseAppRecord("stock-exchange", "paper-order", { exchange: "NSE", symbol: "ABC", side: "buy", quantity: 1.5, price: 100 }));
  assert.throws(() => records.parseAppRecord("stock-exchange", "paper-order", { exchange: "NSE", symbol: "ABC", side: "withdraw", quantity: 1, price: 100 }));
});

test("watchlist rejects future manual quote dates", () => {
  assert.throws(() => records.parseAppRecord("stock-exchange", "instrument", { exchange: "NSE", symbol: "ABC", referencePrice: 100, priceAsOf: "2099-01-01" }));
});

test("watchlist preserves canonical-search metadata without accepting malformed ISINs", () => {
  const instrument = records.parseAppRecord("stock-exchange", "instrument", { exchange: "NSE", symbol: "INFY", companyName: "Infosys Limited", aliases: "Infosys, INFOSYS", isin: "INE009A01021", tradingStatus: "active", referencePrice: 100, priceAsOf: "2026-01-01" });
  assert.equal(instrument.payload.companyName, "Infosys Limited");
  assert.deepEqual(instrument.payload.aliases, ["Infosys", "INFOSYS"]);
  assert.equal(instrument.payload.isin, "INE009A01021");
  assert.throws(() => records.parseAppRecord("stock-exchange", "instrument", { exchange: "NSE", symbol: "INFY", isin: "not-an-isin", referencePrice: 100, priceAsOf: "2026-01-01" }));
});

test("Stock Intelligence observations require a valid source and preserve provenance", () => {
  assert.throws(() => records.parseAppRecord("stock-exchange", "market-observation", { exchange: "NSE", symbol: "DEMO", asOf: "2026-01-01", close: 100, sourceUrl: "http://example.test", sourceClass: "verified_filing" }));
  const result = records.parseAppRecord("stock-exchange", "market-observation", { exchange: "NSE", symbol: "DEMO", asOf: "2026-01-01", close: 100, volume: 1000, sourceUrl: "https://example.test/filing", sourceClass: "verified_filing" });
  assert.equal(result.payload.sourceUrl, "https://example.test/filing");
  assert.equal(result.payload.sourceClass, "verified_filing");
});

test("financial statements preserve reporting basis, units, provenance and null values", () => {
  const result = records.parseAppRecord("stock-exchange", "financial-statement", { symbol: "TEST", exchange: "NSE", statement: "income", scope: "consolidated", periodType: "annual", periodEnd: "2026-03-31", publishedAt: "2026-05-01", currency: "INR", unit: "crores", actual: true, values: { revenue: 1000, netProfit: null }, sourceUrl: "https://example.test/annual", sourceClass: "company_statement" });
  assert.equal(result.payload.scope, "consolidated");
  assert.equal(result.payload.unit, "crores");
  assert.equal(result.payload.values.netProfit, null);
  assert.throws(() => records.parseAppRecord("stock-exchange", "financial-statement", { ...result.payload, statement: "unknown" }));
});

test("dividend disclosures remain source-attributed financial records rather than inferred zero payouts", () => {
  const dividend = records.parseAppRecord("stock-exchange", "financial-statement", { symbol: "TEST", exchange: "NSE", statement: "dividend", scope: "consolidated", periodType: "annual", periodEnd: "2026-03-31", publishedAt: "2026-05-01", currency: "INR", unit: "ones", actual: true, values: { dividendPerShare: 2, specialDividendPerShare: null }, sourceUrl: "https://example.test/dividend", sourceClass: "verified_filing" });
  assert.equal(dividend.payload.statement, "dividend");
  assert.equal(dividend.payload.values.specialDividendPerShare, null);
});

test("financial disclosure contract preserves explicit unit and cumulative-period metadata", () => {
  const result = records.parseAppRecord("stock-exchange", "financial-statement", { symbol: "TEST", exchange: "NSE", statement: "income", scope: "consolidated", periodType: "quarterly", periodStart: "2025-04-01", periodEnd: "2025-06-30", publishedAt: "2025-08-01", filingDate: "2025-08-01", currency: "INR", unit: "millions", cumulative: false, actual: true, values: { revenue: 10 }, sourceUrl: "https://example.test/quarter", sourceClass: "verified_filing" });
  assert.equal(result.payload.unit, "millions");
  assert.equal(result.payload.periodStart, "2025-04-01");
  assert.equal(result.payload.cumulative, false);
});
