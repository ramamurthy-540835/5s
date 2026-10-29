import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../frontend/app/api/prism/auth/switch/route.ts", import.meta.url), "utf8");
const route = {};
let user = { id: "member", email: "ai@aidirac.com", role: "member", orgId: "property-auctions" };
new Function("exports", "require", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(route, (name) => {
  if (name === "next/server") return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
  if (name === "@backend/lib/auth") return { getSession: () => user };
  throw new Error(name);
});
const request = (email) => ({ json: async () => ({ email }) });

test("account switch confirms only the currently server-verified session", async () => {
  user = { id: "member", email: "ai@aidirac.com", role: "member", orgId: "property-auctions" };
  const current = await route.POST(request("ai@aidirac.com"));
  assert.equal(current.status, 200);
  assert.deepEqual(current.body.user, { email: "ai@aidirac.com", role: "member" });

  const other = await route.POST(request("another@example.test"));
  assert.equal(other.status, 409);
  assert.equal(other.body.error, "A new sign-in is required");
});

test("account switch rejects requests without a valid session", async () => {
  user = null;
  const response = await route.POST(request("ai@aidirac.com"));
  assert.equal(response.status, 401);
});
