import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../backend/lib/market-data-provider.ts", import.meta.url), "utf8");
const providerModule = {};
new Function("exports", "require", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(providerModule, () => { throw new Error("Unexpected dependency"); });

test("provider execution enforces declared capabilities and caches an approved adapter call", async () => {
  const registry = providerModule.marketDataProviders;
  let calls = 0;
  registry.register({
    name: "fixture-provider", classification: "EOD", capabilities: ["eod_history"],
    searchInstruments: async () => ({ items: [], nextCursor: null }), history: async () => [], corporateActions: async () => [], fundamentals: async () => [], indices: async () => [], announcements: async () => ({ items: [], nextCursor: null }),
  });
  const request = { provider: "fixture-provider", capability: "eod_history", cacheKey: "fixture:history", ttlMs: 1_000, load: async () => { calls += 1; return ["ok"]; } };
  assert.deepEqual(await providerModule.executeProviderRequest(request), ["ok"]);
  assert.deepEqual(await providerModule.executeProviderRequest(request), ["ok"]);
  assert.equal(calls, 1);
  await assert.rejects(() => providerModule.executeProviderRequest({ ...request, capability: "news", cacheKey: "fixture:news" }), /not entitled/);
});
