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
const templateImport = load("../backend/lib/industrial-5s-template-import.ts", { "./industrial-5s": industrial });
const pdf = load("../backend/lib/industrial-5s-pdf.ts");
const imageAi = load("../backend/lib/industrial-5s-ai.ts", { "./industrial-5s": industrial, "./env": { env: { projectId: "test-project" } } });
const jobs = load("../backend/lib/industrial-5s-jobs.ts", { "./env": { env: { projectId: "test-project" } } });
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

test("company templates reject unsafe, duplicate, and unmapped required cells", () => {
  const template = industrial.defaultCncTemplate();
  const unsafe = { ...template, requiredFields: ["machine_asset_number", "missing_field"], fieldMappings: [{ canonicalField: "machine_asset_number", label: "=formula", target: "B2" }, { canonicalField: "another", label: "Other", target: "B2" }] };
  const codes = industrial.validateCompanyTemplate(unsafe).map((item) => item.code);
  assert.ok(codes.includes("TEMPLATE_FORMULA_INJECTION"));
  assert.ok(codes.includes("TEMPLATE_DUPLICATE_TARGET"));
  assert.ok(codes.includes("TEMPLATE_REQUIRED_MAPPING"));
});

test("background dispatch is fail-closed until all Cloud Tasks worker configuration exists", () => {
  const prior = { queue: process.env.PRISM_5S_TASK_QUEUE, url: process.env.PRISM_5S_WORKER_URL, token: process.env.PRISM_5S_WORKER_TOKEN, serviceAccount: process.env.PRISM_5S_TASK_SERVICE_ACCOUNT };
  delete process.env.PRISM_5S_TASK_QUEUE; delete process.env.PRISM_5S_WORKER_URL; delete process.env.PRISM_5S_WORKER_TOKEN; delete process.env.PRISM_5S_TASK_SERVICE_ACCOUNT;
  assert.equal(jobs.backgroundJobsConfigured(), false);
  process.env.PRISM_5S_TASK_QUEUE = "queue"; process.env.PRISM_5S_WORKER_URL = "https://worker.example"; process.env.PRISM_5S_TASK_SERVICE_ACCOUNT = "tasks@test-project.iam.gserviceaccount.com";
  assert.equal(jobs.backgroundJobsConfigured(), true);
  for (const [key, value] of Object.entries(prior)) { const env = key === "queue" ? "PRISM_5S_TASK_QUEUE" : key === "url" ? "PRISM_5S_WORKER_URL" : key === "serviceAccount" ? "PRISM_5S_TASK_SERVICE_ACCOUNT" : "PRISM_5S_WORKER_TOKEN"; if (value === undefined) delete process.env[env]; else process.env[env] = value; }
});

test("XLSX generator creates a real two-sheet workbook in the mandatory order", () => {
  const extraction = { schemaVersion: "1.0", inspectionId: "i", documentType: "cnc", documentClassificationStatus: "confirmed", fields: ["report_reference_number", "inspection_date", "machine_asset_number", "machine_name"].map((fieldKey) => ({ fieldKey, normalizedValue: "verified", valueType: "text", provenance: [], reviewStatus: "user_verified" })), processRows: [], additionalNotes: [], validationIssues: [], sourceAssets: [], extractionVersion: "1.0", agentVersion: "test" };
  const body = xlsx.createIndustrialWorkbook({ schemaVersion: "1.0", inspectionId: "i", tenantId: "t", outputFilename: "x.xlsx", snapshot: { schemaVersion: "1.0", inspectionId: "i", snapshotVersion: 1, template: { templateId: "platform-cnc-process-time-v1", templateVersion: "1.0", templateName: "CNC" }, extraction, images: [], verifiedBy: "u", verifiedAt: "now" } }, []);
  assert.equal(body.subarray(0, 4).toString("hex"), "504b0304");
  const workbook = zipEntry(body, "xl/workbook.xml");
  assert.match(workbook, /Inspection Report/);
  assert.match(workbook, /Machinery Images/);
});

test("XLSX template inspection exposes sheet structure and editable canonical mapping suggestions", () => {
  const extraction = { schemaVersion: "1.0", inspectionId: "i", documentType: "cnc", documentClassificationStatus: "confirmed", fields: [], processRows: [], additionalNotes: [], validationIssues: [], sourceAssets: [], extractionVersion: "1.0", agentVersion: "test" };
  const workbook = xlsx.createIndustrialWorkbook({ schemaVersion: "1.0", inspectionId: "i", tenantId: "t", outputFilename: "template.xlsx", snapshot: { schemaVersion: "1.0", inspectionId: "i", snapshotVersion: 1, template: { templateId: "platform-cnc-process-time-v1", templateVersion: "1.0", templateName: "CNC" }, extraction, images: [], verifiedBy: "u", verifiedAt: "now" } }, []);
  const inspection = templateImport.inspectXlsxTemplate(workbook);
  assert.deepEqual(inspection.sheets.map((sheet) => sheet.name), ["Inspection Report", "Machinery Images"]);
  assert.ok(inspection.suggestedMappings.some((mapping) => mapping.canonicalField === "report_reference_number" && /^[A-Z]+\d+$/.test(mapping.target)));
  assert.deepEqual(inspection.warnings, []);
});

test("PDF annotation geometry preserves normalized evidence across quarter-turn rotations", () => {
  assert.deepEqual(pdf.annotationRect([0.1, 0.2, 0.4, 0.5], 0), { left: 0.1, top: 0.2, width: 0.30000000000000004, height: 0.3 });
  assert.deepEqual(pdf.annotationRect([0.1, 0.2, 0.4, 0.5], 90), { left: 0.5, top: 0.1, width: 0.3, height: 0.30000000000000004 });
  assert.throws(() => pdf.annotationRect([0, 0, 2, 1], 0), /Invalid normalized/);
});

function littleEndianTiff() {
  const data = Buffer.alloc(96); data.write("II", 0, "ascii"); data.writeUInt16LE(42, 2); data.writeUInt32LE(8, 4); data.writeUInt16LE(2, 8);
  data.writeUInt16LE(0x8769, 10); data.writeUInt16LE(4, 12); data.writeUInt32LE(1, 14); data.writeUInt32LE(38, 18);
  data.writeUInt16LE(0x0112, 22); data.writeUInt16LE(3, 24); data.writeUInt32LE(1, 26); data.writeUInt16LE(6, 30); data.writeUInt32LE(0, 34);
  data.writeUInt16LE(1, 38); data.writeUInt16LE(0x9003, 40); data.writeUInt16LE(2, 42); data.writeUInt32LE(20, 44); data.writeUInt32LE(60, 48); data.writeUInt32LE(0, 52); data.write("2026:11:14 10:20:30\0", 60, "ascii"); return data;
}
test("EXIF parser reads JPEG, PNG and WebP capture metadata without upload-time inference", () => {
  const tiff = littleEndianTiff(); const jpegPayload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]); const jpeg = Buffer.alloc(4); jpeg.writeUInt16BE(0xffd8, 0); jpeg.writeUInt16BE(0xffe1, 2); const jpegBytes = Buffer.concat([jpeg, Buffer.from([0, jpegPayload.length + 2]), jpegPayload]);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from([0, 0, 0, tiff.length]), Buffer.from("eXIf"), tiff, Buffer.alloc(4)]);
  const webp = Buffer.concat([Buffer.from("RIFFxxxxWEBPEXIF", "latin1"), Buffer.from([tiff.length, 0, 0, 0]), tiff]);
  for (const [bytes, type] of [[jpegBytes, "image/jpeg"], [png, "image/png"], [webp, "image/webp"]]) { const candidate = imageAi.extractExifDateTime(bytes, "Asia/Kolkata", type); assert.ok(candidate, `Expected EXIF candidate for ${type}`); assert.equal(candidate.source, "exif"); assert.equal(candidate.localDateTime, "2026-11-14T10:20:30"); assert.equal(candidate.metadata?.orientation, 6); }
});

test("filename timestamps are preserved only as lower-priority review evidence", () => {
  const candidate = imageAi.extractFilenameDateTime("Machine_20261114_102030_before.webp", "Asia/Kolkata");
  assert.equal(candidate?.source, "filename");
  assert.equal(candidate?.localDateTime, "2026-11-14T10:20:30");
  assert.match(candidate?.warning || "", /requires verification/i);
  assert.equal(imageAi.extractFilenameDateTime("machine-before.webp", "Asia/Kolkata"), undefined);
});

test("timestamp resolution retains conflicts, accepts a verified manual correction, and sorts stable duplicates", () => {
  const watermark = { source: "visible_watermark", rawValue: "2026-11-14 10:00", localDateTime: "2026-11-14T10:00:00", valid: true };
  const exif = { source: "exif", rawValue: "2026:11:14 10:01:00", localDateTime: "2026-11-14T10:01:00", valid: true };
  assert.equal(industrial.resolveImageTimestamp([watermark, exif], 1).timestampStatus, "conflict");
  const manual = { source: "user_confirmed", rawValue: "2026-11-14T10:02", localDateTime: "2026-11-14T10:02:00", valid: true, provenance: "manual" };
  const resolved = industrial.resolveImageTimestamp([watermark, exif, manual], 1); assert.equal(resolved.timestampStatus, "verified"); assert.equal(resolved.timestampSource, "user_confirmed");
  const base = { schemaVersion: "1.0", objectPath: "p", contentType: "image/jpeg", watermarkDetected: false, timestampCandidates: [], timestampSource: "user_confirmed", timestampStatus: "verified", imageCategory: "x", warnings: [], agentVersion: "test" };
  assert.deepEqual(industrial.sortImageTimeline([{ ...base, imageId: "two", originalFilename: "two", uploadSequence: 2, resolvedCaptureDatetime: "2026-11-14T10:02:00" }, { ...base, imageId: "one", originalFilename: "one", uploadSequence: 1, resolvedCaptureDatetime: "2026-11-14T10:02:00" }]).map((item) => item.imageId), ["one", "two"]);
});

test("workbook machinery-image rows follow the verified chronological timeline", () => {
  const extraction = { schemaVersion: "1.0", inspectionId: "i", documentType: "cnc", documentClassificationStatus: "confirmed", fields: [], processRows: [], additionalNotes: [], validationIssues: [], sourceAssets: [], extractionVersion: "1.0", agentVersion: "test" };
  const base = { schemaVersion: "1.0", objectPath: "private", contentType: "image/png", watermarkDetected: false, timestampCandidates: [], timestampSource: "user_confirmed", timestampStatus: "verified", imageCategory: "inspection", warnings: [], agentVersion: "test" };
  const timeline = industrial.sortImageTimeline([{ ...base, imageId: "later", originalFilename: "later.png", uploadSequence: 1, resolvedCaptureDatetime: "2026-11-14T12:00:00" }, { ...base, imageId: "earlier", originalFilename: "earlier.png", uploadSequence: 2, resolvedCaptureDatetime: "2026-11-14T09:00:00" }]);
  const workbook = xlsx.createIndustrialWorkbook({ schemaVersion: "1.0", inspectionId: "i", tenantId: "t", outputFilename: "images.xlsx", snapshot: { schemaVersion: "1.0", inspectionId: "i", snapshotVersion: 1, template: { templateId: "platform-cnc-process-time-v1", templateVersion: "1.0", templateName: "CNC" }, extraction, images: timeline, verifiedBy: "u", verifiedAt: "now" } }, timeline.map((image) => ({ image, bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) })));
  const sheet = zipEntry(workbook, "xl/worksheets/sheet2.xml"); assert.ok(sheet.indexOf("2026-11-14T09:00:00") < sheet.indexOf("2026-11-14T12:00:00")); assert.match(zipEntry(workbook, "xl/drawings/drawing1.xml"), /Machinery photo 1/);
});
