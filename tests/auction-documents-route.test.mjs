import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const recordId = "00000000-0000-0000-0000-000000000010";
const documentId = "00000000-0000-0000-0000-000000000011";
const listing = { id: recordId, owner_id: "seller", status: "review", payload_json: JSON.stringify({ documents: [{ id: documentId, name: "sale-deed.pdf", type: "sale_deed", contentType: "application/pdf", size: 10, storagePath: `property-auctions/property-auctions/${recordId}/${documentId}.pdf`, uploadedAt: "2026-10-24T00:00:00.000Z" }] }) };
let user = { id: "seller", email: "seller@example.test", orgId: "property-auctions", role: "member" };
let rows = [listing];
let reads = 0;

const source = fs.readFileSync(new URL("../frontend/app/api/prism/apps/[app]/[recordId]/documents/route.ts", import.meta.url), "utf8");
const route = {};
new Function("exports", "require", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(route, (name) => {
  if (name === "next/server") return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
  if (name === "crypto") return { randomUUID: () => documentId };
  if (name === "@google-cloud/storage") return { Storage: class { bucket() { return { file: () => ({ save: async () => {}, delete: async () => {}, getSignedUrl: async () => ["https://signed.example.test/temporary"] }) }; } } };
  if (name === "@backend/lib/auth") return { getSession: () => user };
  if (name === "@backend/lib/bootstrap") return { ensureSeeded: async () => {} };
  if (name === "@backend/lib/env") return { env: { projectId: "project", dataset: "dataset", propertyAuctionDocumentsBucket: "bucket" } };
  if (name === "@backend/lib/app-tenancy") return {
    appOrgId: () => "property-auctions",
  };
  if (name === "@backend/lib/bigquery") return { queryBigQuery: async () => { reads += 1; return rows; } };
  throw new Error(name);
});

const params = { params: { app: "property-auctions", recordId } };
const download = () => route.GET({ url: `https://app.test/documents?documentId=${documentId}` }, params);
const upload = (documentType, document) => route.POST({ formData: async () => { const form = new FormData(); form.set("documentType", documentType); form.set("document", document); return form; } }, params);

test("owner and authorized admin receive a short-lived document URL", async () => {
  user = { id: "seller", email: "seller@example.test", orgId: "property-auctions", role: "member" }; rows = [listing];
  const owner = await download();
  assert.equal(owner.status, 200);
  assert.equal(owner.body.url, "https://signed.example.test/temporary");

  user = { id: "admin", email: "admin@example.test", orgId: "naturelabs", role: "admin" }; rows = [listing];
  const admin = await download();
  assert.equal(admin.status, 200);
});

test("unrelated members, including members from another PRISM organization, cannot retrieve documents", async () => {
  user = { id: "other", email: "other@example.test", orgId: "property-auctions", role: "member" }; rows = [listing];
  const unrelated = await download();
  assert.equal(unrelated.status, 403);

  user = { id: "external-user", email: "external@example.test", orgId: "another-tenant", role: "member" }; rows = [listing]; reads = 0;
  const crossTenant = await download();
  assert.equal(crossTenant.status, 403);
  assert.equal(reads, 1);
});

test("invalid and oversized document uploads are rejected before storage", async () => {
  user = { id: "seller", email: "seller@example.test", orgId: "property-auctions", role: "member" }; rows = [listing];
  const invalid = await upload("sale_deed", new File(["not a PDF"], "notes.txt", { type: "text/plain" }));
  assert.equal(invalid.status, 400);

  const oversized = await upload("property_image", new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
  assert.equal(oversized.status, 413);
});
