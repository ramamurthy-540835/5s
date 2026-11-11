import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const validatorSource = fs.readFileSync(new URL("../backend/lib/app-records.ts", import.meta.url), "utf8");
const validator = {};
new Function("exports", "require", ts.transpileModule(validatorSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(validator, () => {});
const intelligenceSource = fs.readFileSync(new URL("../backend/lib/stock-intelligence.ts", import.meta.url), "utf8");
const intelligence = {};
new Function("exports", "require", ts.transpileModule(intelligenceSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(intelligence, () => {});
const routeSource = fs.readFileSync(new URL("../frontend/app/api/prism/apps/[app]/route.ts", import.meta.url), "utf8");
const route = {};
const writes = [];
const reads = [];
let user = { id: "member", email: "member@example.test", orgId: "org", role: "member" };
let selected = [];
new Function("exports", "require", ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(route, (name) => {
  if (name === "next/server") return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
  if (name === "crypto") return { randomUUID: () => "00000000-0000-0000-0000-000000000001" };
  if (name === "@backend/lib/auth") return { getSession: () => user };
  if (name === "@backend/lib/bootstrap") return { ensureSeeded: async () => {} };
  if (name === "@backend/lib/env") return { env: { projectId: "project", dataset: "dataset" } };
  if (name === "@backend/lib/bigquery") return { queryBigQuery: async (sql, params = {}) => {
    if (sql.startsWith("INSERT") || sql.startsWith("UPDATE")) { writes.push(sql); return []; }
    reads.push({ sql, params });
    return Array.isArray(selected[0]) ? (selected.shift() || []) : selected;
  } };
  if (name === "@backend/lib/app-records") return validator;
  if (name === "@backend/lib/stock-intelligence") return intelligence;
  if (name === "@backend/lib/market-data-provider") return { marketDataProviderStatus: () => ({ configured: false, provider: null, classification: "unavailable", reason: "No approved licensed market-data provider is configured." }) };
  if (name === "@backend/lib/app-tenancy") return {
    appOrgId: (app, session) => app === "property-auctions" ? "property-auctions" : session.orgId,
  };
  throw new Error(name);
});
const request = (body) => ({ json: async () => body });
const getRequest = (url = "https://app.test/api/prism/apps/property-auctions") => ({ url });

test("anonymous users cannot create application records", async () => {
  user = null; writes.length = 0;
  const response = await route.POST(request({ kind: "shipment", payload: {} }), { params: { app: "textile-exports" } });
  assert.equal(response.status, 401);
  assert.equal(writes.length, 0);
  user = { id: "member", email: "member@example.test", orgId: "org", role: "member" };
});
test("members cannot approve their own auction listing", async () => {
  user = { id: "member", email: "member@example.test", orgId: "property-auctions", role: "member" };
  selected = [{ id: "00000000-0000-0000-0000-000000000001", owner_id: "member", kind: "listing", status: "review", payload_json: "{}" }];
  writes.length = 0;
  const response = await route.PATCH(request({ id: "00000000-0000-0000-0000-000000000001", status: "open" }), { params: { app: "property-auctions" } });
  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
});
test("property auctions use the shared marketplace tenant for original members, colleagues and admins", async () => {
  user = { id: "ai@aidirac.com", email: "ai@aidirac.com", orgId: "naturelabs", role: "member" };
  selected = [];
  writes.length = 0; reads.length = 0;
  const create = await route.POST(request({ kind: "listing", payload: { address: "1 Market Road", seller: "Seller", valuation: 1000, reservePrice: 800, closesOn: "2099-01-01" } }), { params: { app: "property-auctions" } });
  assert.equal(create.status, 201);
  assert.ok(writes.some((sql) => sql.includes("app_records")));

  user = { id: "admin", email: "admin@example.test", orgId: "naturelabs", role: "admin" };
  selected = [[{ id: "00000000-0000-0000-0000-000000000003", owner_id: "ai@aidirac.com", kind: "listing", status: "review", title: "1 Market Road", payload_json: "{}" }]];
  const approve = await route.PATCH(request({ id: "00000000-0000-0000-0000-000000000003", status: "open" }), { params: { app: "property-auctions" } });
  assert.equal(approve.status, 200);
  assert.equal(reads.at(-1).params.orgId, "property-auctions");

  user = { id: "anuradha.anand43@gmail.com", email: "anuradha.anand43@gmail.com", orgId: "partner-org", role: "member" };
  selected = [[{ id: "open-listing", owner_id: "seller", kind: "listing", status: "open", title: "1 Market Road", payload_json: JSON.stringify({ closesOn: "2099-01-01", reservePrice: 500 }), created_at: "", updated_at: "" }], [{ id: "bidder-verification" }], []];
  const bid = await route.POST(request({ kind: "bid", payload: { listingId: "open-listing", bidAmount: 600 } }), { params: { app: "property-auctions" } });
  assert.equal(bid.status, 201);
  assert.ok(reads.every((read) => read.params.orgId === "property-auctions"));
});
// End of application-route regression tests.
test("member Records are owner-filtered while the auction overview is aggregate-only", async () => {
  user = { id: "ai@aidirac.com", email: "ai@aidirac.com", orgId: "naturelabs", role: "member" };
  selected = [[{ id: "member-listing", owner_id: "ai@aidirac.com", kind: "listing", status: "open", title: "Velachery", payload_json: "{}", created_at: "", updated_at: "" }]];
  reads.length = 0;
  const personal = await route.GET(getRequest(), { params: { app: "property-auctions" } });
  assert.equal(personal.status, 200);
  assert.equal(personal.body.length, 1);
  assert.equal(reads[0].params.private, true);
  assert.equal(reads[0].params.userId, "ai@aidirac.com");
  assert.equal(reads[0].params.orgId, "property-auctions");

  selected = [
    [{ id: "open-listing", owner_id: "colleague", kind: "listing", status: "open", title: "Shared listing", payload_json: JSON.stringify({ reservePrice: 100, closesOn: "2099-01-01", listingFee: 0.25 }), created_at: "", updated_at: "" }],
    [{ payload_json: JSON.stringify({ listingId: "open-listing", bidAmount: 150 }) }],
  ];
  const overview = await route.GET(getRequest("https://app.test/api/prism/apps/property-auctions?view=overview"), { params: { app: "property-auctions" } });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.openListings[0].bidCount, 1);
  assert.equal(overview.body.openListings[0].highestBid, 150);
  assert.equal("ownerId" in overview.body.openListings[0], false);

  user = { id: "future@example.test", email: "future@example.test", orgId: "another-org", role: "member" };
  selected = [[]]; reads.length = 0;
  await route.GET(getRequest(), { params: { app: "property-auctions" } });
  assert.equal(reads[0].params.private, true);
  assert.equal(reads[0].params.userId, "future@example.test");
});

test("admin approval opens a review listing and writes an audit log", async () => {
  user = { id: "admin", email: "admin@example.test", orgId: "org", role: "admin" };
  selected = [[{ id: "00000000-0000-0000-0000-000000000001", owner_id: "seller", kind: "listing", status: "review", payload_json: "{}" }]];
  writes.length = 0;
  const response = await route.PATCH(request({ id: "00000000-0000-0000-0000-000000000001", status: "open" }), { params: { app: "property-auctions" } });
  assert.equal(response.status, 200);
  assert.ok(writes.some((sql) => sql.startsWith("UPDATE") && sql.includes("status=@next")));
  assert.ok(writes.some((sql) => sql.startsWith("INSERT") && sql.includes("auction_audit_logs")));
});

test("admin verification approves a bidder and writes an audit log", async () => {
  user = { id: "admin", email: "admin@example.test", orgId: "org", role: "admin" };
  selected = [[{ id: "00000000-0000-0000-0000-000000000002", owner_id: "bidder", kind: "bidder", status: "pending", payload_json: "{}" }]];
  writes.length = 0;
  const response = await route.PATCH(request({ id: "00000000-0000-0000-0000-000000000002", status: "verified" }), { params: { app: "property-auctions" } });
  assert.equal(response.status, 200);
  assert.ok(writes.some((sql) => sql.startsWith("INSERT") && sql.includes("auction_audit_logs")));
});

test("verified bidder can place a simulated bid only on an open listing", async () => {
  user = { id: "bidder", email: "bidder@example.test", orgId: "property-auctions", role: "member" };
  selected = [
    [{ id: "listing-id", owner_id: "seller", kind: "listing", status: "open", title: "Test property", payload_json: JSON.stringify({ closesOn: "2099-01-01", reservePrice: 500 }), created_at: "", updated_at: "" }],
    [{ id: "verification-id" }],
    [],
  ];
  writes.length = 0;
  const response = await route.POST(request({ kind: "bid", payload: { listingId: "listing-id", bidAmount: 600 } }), { params: { app: "property-auctions" } });
  assert.equal(response.status, 201);
  assert.equal(response.body.status, "simulated");
  assert.ok(writes.some((sql) => sql.startsWith("INSERT") && sql.includes("app_records")));
});

test("simulated bid requires bidder verification", async () => {
  user = { id: "unverified", email: "unverified@example.test", orgId: "property-auctions", role: "member" };
  selected = [[{ id: "listing-id", owner_id: "seller", kind: "listing", status: "open", title: "Test property", payload_json: JSON.stringify({ closesOn: "2099-01-01", reservePrice: 500 }), created_at: "", updated_at: "" }], []];
  writes.length = 0;
  const response = await route.POST(request({ kind: "bid", payload: { listingId: "listing-id", bidAmount: 1000 } }), { params: { app: "property-auctions" } });
  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
  user = { id: "member", email: "member@example.test", orgId: "org", role: "member" };
});
// End of application-route regression tests.
