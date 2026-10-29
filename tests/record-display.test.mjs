import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync(new URL("../frontend/components/apps/record-display.ts", import.meta.url), "utf8");
const display = {};
new Function("exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(display);

test("document metadata is readable without storage paths or object stringification", () => {
  const value = display.displayRecordValue("documents", [
    { name: "sale-deed.pdf", storagePath: "property-auctions/private/secret.pdf", contentType: "application/pdf" },
    { name: "front.jpg", storagePath: "property-auctions/private/front.jpg" },
  ]);
  assert.equal(value, "2 private files: sale-deed.pdf, front.jpg");
  assert.ok(!value.includes("[object Object]"));
  assert.ok(!value.includes("storagePath"));
  assert.ok(!value.includes("property-auctions/"));
});
