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
