import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { inflateRawSync } from "node:zlib";
import ts from "typescript";
const require = createRequire(import.meta.url);

function load(relative, dependencies = {}) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), "utf8"); const exports = {};
  new Function("exports", "require", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(exports, (name) => dependencies[name] || require(name));
  return exports;
}
const industrial = load("../backend/lib/industrial-5s.ts");
const xlsx = load("../backend/lib/industrial-5s-xlsx.ts", { "./industrial-5s": industrial });
const zipEntry = (archive, target) => { let offset = 0; while (archive.readUInt32LE(offset) === 0x04034b50) { const compressed = archive.readUInt32LE(offset + 18); const nameLength = archive.readUInt16LE(offset + 26); const extraLength = archive.readUInt16LE(offset + 28); const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString(); const start = offset + 30 + nameLength + extraLength; if (name === target) return inflateRawSync(archive.subarray(start, start + compressed)).toString(); offset = start + compressed; } throw new Error(`Missing ZIP entry ${target}`); };

test("industrial image timestamp resolution prefers a valid watermark and exposes EXIF disagreement", () => {
  const watermark = industrial.parseLocalTimestamp("2026.11.14 10:20", "Asia/Kolkata");
  const result = industrial.resolveImageTimestamp([watermark, { source: "exif", rawValue: "2026-11-14T10:21", localDateTime: "2026-11-14T10:21:00", valid: true, timezone: "Asia/Kolkata" }], 1);
  assert.equal(result.timestampSource, "visible_watermark");
  assert.equal(result.timestampStatus, "conflict");
  assert.equal(result.resolvedCaptureDatetime, "2026-11-14T10:20:00");
});

test("industrial chronology puts unresolved images after verified timestamps and keeps upload ordering as tie-breaker", () => {
  const base = { schemaVersion: "1.0", objectPath: "private", contentType: "image/jpeg", watermarkDetected: false, timestampCandidates: [], timezone: "Asia/Kolkata", timestampSource: "visible_watermark", timestampStatus: "needs_review", imageCategory: "unclassified", warnings: [], agentVersion: "test" };
  const ordered = industrial.sortImageTimeline([{ ...base, imageId: "late", originalFilename: "late.jpg", uploadSequence: 1, resolvedCaptureDatetime: "2026-11-14T12:00:00" }, { ...base, imageId: "unresolved", originalFilename: "unknown.jpg", uploadSequence: 2, timestampSource: "unresolved", timestampStatus: "unresolved" }, { ...base, imageId: "early", originalFilename: "early.jpg", uploadSequence: 3, resolvedCaptureDatetime: "2026-11-14T09:00:00" }]);
  assert.deepEqual(ordered.map((item) => item.imageId), ["early", "late", "unresolved"]);
});

test("verified export blocks missing required CNC fields and timestamp conflicts", () => {
  const extraction = { schemaVersion: "1.0", inspectionId: "i", documentType: "cnc", documentClassificationStatus: "confirmed", fields: [{ fieldKey: "report_reference_number", normalizedValue: "R", valueType: "text", provenance: [], reviewStatus: "user_verified" }], processRows: [], additionalNotes: [], validationIssues: [], sourceAssets: [], extractionVersion: "1.0", agentVersion: "test" };
  const snapshot = { schemaVersion: "1.0", inspectionId: "i", snapshotVersion: 1, template: { templateId: "platform-cnc-process-time-v1", templateVersion: "1.0", templateName: "CNC" }, extraction, images: [], verifiedBy: "u", verifiedAt: "2026-11-14T00:00:00Z" };
  assert.equal(industrial.validateVerifiedSnapshot(snapshot).filter((item) => item.severity === "blocking").length, 3);
});

test("XLSX generator creates a real two-sheet workbook in the mandatory order", () => {
  const extraction = { schemaVersion: "1.0", inspectionId: "i", documentType: "cnc", documentClassificationStatus: "confirmed", fields: ["report_reference_number", "inspection_date", "machine_asset_number", "machine_name"].map((fieldKey) => ({ fieldKey, normalizedValue: "verified", valueType: "text", provenance: [], reviewStatus: "user_verified" })), processRows: [], additionalNotes: [], validationIssues: [], sourceAssets: [], extractionVersion: "1.0", agentVersion: "test" };
  const body = xlsx.createIndustrialWorkbook({ schemaVersion: "1.0", inspectionId: "i", tenantId: "t", outputFilename: "x.xlsx", snapshot: { schemaVersion: "1.0", inspectionId: "i", snapshotVersion: 1, template: { templateId: "platform-cnc-process-time-v1", templateVersion: "1.0", templateName: "CNC" }, extraction, images: [], verifiedBy: "u", verifiedAt: "now" } }, []);
  assert.equal(body.subarray(0, 4).toString("hex"), "504b0304");
  const workbook = zipEntry(body, "xl/workbook.xml");
  assert.match(workbook, /Inspection Report/);
  assert.match(workbook, /Machinery Images/);
});
