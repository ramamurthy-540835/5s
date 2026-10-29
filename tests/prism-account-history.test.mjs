import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../frontend/lib/prism-account-history.ts", import.meta.url), "utf8");
const history = {};
new Function("exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(history);

const values = new Map();
const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };

test("account history stores only verified account labels and limits entries", () => {
  values.clear();
  history.rememberAccount(storage, { email: "ai@aidirac.com", role: "member" });
  history.rememberAccount(storage, { email: "ai@nelture.ai", role: "admin" });
  const raw = values.get(history.prismAccountHistoryKey);
  assert.deepEqual(JSON.parse(raw), [
    { email: "ai@nelture.ai", role: "admin" },
    { email: "ai@aidirac.com", role: "member" },
  ]);
  assert.ok(!/password|token|session/i.test(raw));
});

test("malformed browser history is ignored and cannot inject accounts", () => {
  values.set(history.prismAccountHistoryKey, JSON.stringify([{ email: "not-an-email", role: "admin" }, { email: "other@example.test", role: "owner" }]));
  assert.deepEqual(history.readRememberedAccounts(storage), []);
});
